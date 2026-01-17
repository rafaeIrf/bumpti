"""
Worker Queue Functions for City Hydration
Atomic queue operations with retry logic and failure tracking
"""
import time
import psycopg2


def claim_next_city_from_queue(pg_conn):
    """Atomically claim next pending city from queue.
    
    Uses FOR UPDATE SKIP LOCKED to prevent race conditions between workers.
    
    Returns:
        dict: City data with keys: id, city_name, lat, lng, retry_count, bbox
        None: If queue is empty
    """
    cur = pg_conn.cursor()
    
    try:
        # Atomic claim with lock to prevent race conditions
        query = """
        UPDATE cities_registry
        SET status = 'processing',
            processing_started_at = NOW(),
            retry_count = retry_count + 1
        WHERE id = (
            SELECT id 
            FROM cities_registry
            WHERE status = 'pending'
              AND retry_count < 3
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING id, city_name, lat, lng, retry_count, 
                  ST_XMin(geom) as xmin, ST_YMin(geom) as ymin,
                  ST_XMax(geom) as xmax, ST_YMax(geom) as ymax, country_code;
        """
        
        cur.execute(query)
        result = cur.fetchone()
        pg_conn.commit()
        
        if result:
            city_data = {
                'id': result[0],
                'city_name': result[1],
                'lat': result[2],
                'lng': result[3],
                'retry_count': result[4],
                'bbox': [result[5], result[6], result[7], result[8]] if result[5] else None,
                'country_code': result[9]
            }
            
            city_label = city_data['city_name'] or f"({city_data['lat']:.4f},{city_data['lng']:.4f})"
            print(f"🎯 Claimed: {city_label} (retry #{city_data['retry_count']})")
            
            return city_data
        else:
            return None
            
    except Exception as e:
        pg_conn.rollback()
        print(f"❌ Queue claim failed: {str(e)}")
        return None
    finally:
        cur.close()


def mark_city_completed(city_id, pg_conn, stats=None):
    """Mark city as successfully completed.
    
    Args:
        city_id: UUID of the city
        pg_conn: Database connection
        stats: Optional stats dict to store in metadata
    """
    cur = pg_conn.cursor()
    
    try:
        cur.execute("""
            UPDATE cities_registry
            SET status = 'completed',
                processing_finished_at = NOW(),
                last_error = NULL
            WHERE id = %s
        """, (city_id,))
        
        pg_conn.commit()
        print(f"✅ City {city_id} marked as completed")
        
        if stats:
            print(f"   📊 Stats: {stats.get('inserted', 0)} inserted, {stats.get('updated', 0)} updated")
            
    except Exception as e:
        pg_conn.rollback()
        print(f"⚠️  Failed to mark city completed: {str(e)}")
    finally:
        cur.close()


def handle_city_failure(city_id, error_msg, pg_conn):
    """Handle city processing failure with retry logic.
    
    Args:
        city_id: UUID of the city
        error_msg: Error message to store
        pg_conn: Database connection
    
    Logic:
        - If retry_count < 3: Set status='pending' (retry)
        - If retry_count >= 3: Set status='manual_review' (permanent failure)
    """
    cur = pg_conn.cursor()
    
    try:
        # Get current retry count
        cur.execute("SELECT retry_count, city_name FROM cities_registry WHERE id = %s", (city_id,))
        result = cur.fetchone()
        
        if not result:
            print(f"⚠️  City {city_id} not found in registry")
            return
        
        retry_count, city_name = result
        
        if retry_count >= 3:
            # Permanent failure
            new_status = 'manual_review'
            print(f"🔴 {city_name}: Exceeded retry limit → manual_review")
            print(f"   Last error: {error_msg[:200]}")
        else:
            # Temporary failure, back to queue
            new_status = 'pending'
            print(f"⚠️  {city_name}: Failed (retry {retry_count}/3) → back to queue")
            print(f"   Error: {error_msg[:100]}")
        
        cur.execute("""
            UPDATE cities_registry
            SET status = %s,
                last_error = %s,
                processing_finished_at = NOW()
            WHERE id = %s
        """, (new_status, error_msg[:1000], city_id))  # Limit error message to 1000 chars
        
        pg_conn.commit()
        
    except Exception as e:
        pg_conn.rollback()
        print(f"❌ Failed to handle city failure: {str(e)}")
    finally:
        cur.close()


def get_queue_stats(pg_conn):
    """Get current queue statistics.
    
    Returns:
        dict: Queue stats with counts by status
    """
    cur = pg_conn.cursor()
    
    try:
        cur.execute("""
            SELECT status, COUNT(*) as count
            FROM cities_registry
            GROUP BY status
            ORDER BY status
        """)
        
        results = cur.fetchall()
        stats = {status: count for status, count in results}
        
        return stats
        
    except Exception as e:
        print(f"⚠️  Failed to get queue stats: {str(e)}")
        return {}
    finally:
        cur.close()


def worker_main_loop(max_runtime_seconds=1500):  # 25 minutes default
    """Main worker loop that processes cities from queue.
    
    Args:
        max_runtime_seconds: Maximum runtime before graceful exit (default 25min for GitHub)
    
    Process:
        1. Check if timeout approaching
        2. Claim next city from queue (atomic)
        3. Process city
        4. Mark as completed or failed
        5. Repeat until queue empty or timeout
    """
    import os
    
    start_time = time.time()
    processed_count = 0
    
    # Database connection for queue operations
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable not set")
    
    print(f"\n🚀 Worker started (max runtime: {max_runtime_seconds//60} minutes)")
    
    # Main worker loop
    while True:
        # Check timeout
        elapsed = time.time() - start_time
        if elapsed > max_runtime_seconds:
            print(f"\n⏰ Worker timeout approaching ({elapsed//60:.1f} min), exiting gracefully")
            break
        
        # Open fresh connection for each city (prevents connection leaks)
        pg_conn = psycopg2.connect(DATABASE_URL)
        
        try:
            # 1. Claim next city from queue (atomic)
            city_data = claim_next_city_from_queue(pg_conn)
            
            if not city_data:
                # Queue is empty
                print("\n✅ Queue empty, worker finished")
                pg_conn.close()
                break
            
            city_id = city_data['id']
            
            # 2. Process city
            print(f"\n{'='*70}")
            print(f"[QUEUE] Processing city {processed_count + 1}")
            
            try:
                # Import main processing function
                from scripts.hydrate_overture_city import process_single_city
                
                stats = process_single_city(city_data, pg_conn)
                mark_city_completed(city_id, pg_conn, stats)
                processed_count += 1
                
            except Exception as e:
                error_msg = f"Processing failed: {str(e)}"
                print(f"❌ {error_msg}")
                handle_city_failure(city_id, error_msg, pg_conn)
            
        finally:
            # Always close connection
            pg_conn.close()
        
        # Show progress
        print(f"\n📊 Progress: {processed_count} cities processed, {elapsed//60:.1f} min elapsed")
    
    # Final stats
    print(f"\n{'='*70}")
    print(f"✅ Worker finished")
    print(f"   Cities processed: {processed_count}")
    print(f"   Runtime: {(time.time() - start_time)//60:.1f} minutes")
    
    # Show final queue state
    pg_conn = psycopg2.connect(DATABASE_URL)
    stats = get_queue_stats(pg_conn)
    pg_conn.close()
    
    print(f"\n📊 Queue Status:")
    for status, count in stats.items():
        print(f"   {status}: {count}")
