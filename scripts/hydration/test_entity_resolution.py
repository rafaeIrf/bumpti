"""
Entity Resolution - Regression Tests

Validates that the entity resolution system correctly:
1. Generates deterministic normalization keys
2. Prevents false positives (different entities merged)
3. Allows true positives (same entity with variations)
4. Uses address anchoring to disambiguiate
"""

import sys
sys.path.insert(0, '/Users/rafael/workspace/bumpti/scripts')

from hydration.deduplication import (
    generate_normalization_key,
    has_matching_address_anchor,
    are_same_entity,
    POI
)


def test_normalization_key():
    """Test deterministic key generation."""
    print("🧪 Test 1: Normalization Key Generation")
    
    # Test 1: Portuguese connectors removed
    assert generate_normalization_key("Bar do Alemão") == "alemao bar"
    print("  ✅ 'Bar do Alemão' → 'alemao bar'")
    
    # Test 2: Accents removed
    assert generate_normalization_key("Parque Barigüi") == "barigui parque"
    print("  ✅ 'Parque Barigüi' → 'barigui parque'")
    
    # Test 3: Special characters removed
    assert generate_normalization_key("McDonald's") == "mcdonalds"
    print("  ✅ 'McDonald's' → 'mcdonalds'")
    
    # Test 4: English connectors removed
    assert generate_normalization_key("The Grand Hotel") == "grand hotel"
    print("  ✅ 'The Grand Hotel' → 'grand hotel'")
    
    # Test 5: Numbers preserved and sorted
    assert generate_normalization_key("Bar 123 ABC") == "123 abc bar"
    print("  ✅ 'Bar 123 ABC' → '123 abc bar'")
    
    print()


def test_address_anchoring():
    """Test address-based disambiguation."""
    print("🧪 Test 2: Address Anchoring")
    
    # Test 1: Different house numbers → different entities
    poi1 = POI(
        name="Bar A", lat=-25.4, lng=-49.3, category="bar",
        overture_id="id1", house_number="100", postal_code="80000",
        relevance_score=100, normalization_key="a bar", row_data=()
    )
    poi2 = POI(
        name="Bar A", lat=-25.4, lng=-49.3, category="bar",
        overture_id="id2", house_number="102", postal_code="80000",
        relevance_score=100, normalization_key="a bar", row_data=()
    )
    assert not has_matching_address_anchor(poi1, poi2)
    print("  ✅ 'Bar A #100' ≠ 'Bar A #102' (different house numbers)")
    
    # Test 2: Same house number → same entity
    poi3 = POI(
        name="Bar A", lat=-25.4, lng=-49.3, category="bar",
        overture_id="id3", house_number="100", postal_code="80000",
        relevance_score=100, normalization_key="a bar", row_data=()
    )
    assert has_matching_address_anchor(poi1, poi3)
    print("  ✅ 'Bar A #100' == 'Bar A #100' (same address)")
    
    # Test 3: Different postal codes → different entities
    poi4 = POI(
        name="Café B", lat=-25.4, lng=-49.3, category="cafe",
        overture_id="id4", house_number="", postal_code="80000",
        relevance_score=100, normalization_key="b cafe", row_data=()
    )
    poi5 = POI(
        name="Café B", lat=-25.4, lng=-49.3, category="cafe",
        overture_id="id5", house_number="", postal_code="80100",
        relevance_score=100, normalization_key="b cafe", row_data=()
    )
    assert not has_matching_address_anchor(poi4, poi5)
    print("  ✅ 'Café B CEP 80000' ≠ 'Café B CEP 80100' (different postal codes)")
    
    print()


def test_parque_barigui_vs_bacacheri():
    """
    CRITICAL TEST: Ensure different parks are not merged.
    
    This is the primary regression test to validate that:
    - Different names generate different normalization keys
    - Parks are not merged just because they're nearby
    """
    print("🧪 Test 3: Parque Barigui vs Parque Bacacheri (CRITICAL)")
    
    barigui = POI(
        name="Parque Barigui",
        lat=-25.4225, lng=-49.3258,
        category="park",
        overture_id="barigui-123",
        house_number="",
        postal_code="82000",
        relevance_score=120,
        normalization_key=generate_normalization_key("Parque Barigui"),
        row_data=()
    )
    
    bacacheri = POI(
        name="Parque Bacacheri",
        lat=-25.4230, lng=-49.3260,  # ~60m away
        category="park",
        overture_id="bacacheri-456",
        house_number="",
        postal_code="82000",
        relevance_score=100,
        normalization_key=generate_normalization_key("Parque Bacacheri"),
        row_data=()
    )
    
    # Verify normalization keys are different
    assert barigui.normalization_key != bacacheri.normalization_key
    print(f"  ✅ Normalization keys differ:")
    print(f"     '{barigui.name}' → '{barigui.normalization_key}'")
    print(f"     '{bacacheri.name}' → '{bacacheri.normalization_key}'")
    
    # Verify they are NOT considered same entity
    assert not are_same_entity(barigui, bacacheri, use_fuzzy_tiebreak=True)
    print(f"  ✅ Different parks NOT merged (even though 60m apart)")
    
    print()


def test_parque_barigui_variations():
    """Test that legitimate variations ARE merged."""
    print("🧪 Test 4: Parque Barigui Variations (TRUE POSITIVES)")
    
    main = POI(
        name="Parque Barigui",
        lat=-25.4225, lng=-49.3258,
        category="park",
        overture_id="main-123",
        house_number="",
        postal_code="82000",
        relevance_score=120,
        normalization_key=generate_normalization_key("Parque Barigui"),
        row_data=()
    )
    
    # Variation 1: Accent typo
    typo = POI(
        name="Parque Barigüi",
        lat=-25.4227, lng=-49.3260,  # 30m away
        category="park",
        overture_id="typo-456",
        house_number="",
        postal_code="82000",
        relevance_score=80,
        normalization_key=generate_normalization_key("Parque Barigüi"),
        row_data=()
    )
    
    # Should merge (same normalization key)
    assert main.normalization_key == typo.normalization_key
    assert are_same_entity(main, typo, use_fuzzy_tiebreak=True)
    print(f"  ✅ 'Parque Barigui' == 'Parque Barigüi' (accent variation)")
    
    # Variation 2: Full name
    full = POI(
        name="Parque Municipal do Barigui",
        lat=-25.4226, lng=-49.3259,  # 20m away
        category="park",
        overture_id="full-789",
        house_number="",
        postal_code="82000",
        relevance_score=100,
        normalization_key=generate_normalization_key("Parque Municipal do Barigui"),
        row_data=()
    )
    
    # Should merge via fuzzy tiebreak (> 0.95 similarity)
    assert are_same_entity(main, full, use_fuzzy_tiebreak=True)
    print(f"  ✅ 'Parque Barigui' == 'Parque Municipal do Barigui' (fuzzy > 0.95)")
    
    print()


def test_gers_id_priority():
    """Test that same GERS ID always merges."""
    print("🧪 Test 5: GERS ID Priority")
    
    poi1 = POI(
        name="Different Name A",
        lat=-25.4, lng=-49.3,
        category="bar",
        overture_id="same-gers-id",  # SAME ID
        house_number="100",
        postal_code="80000",
        relevance_score=100,
        normalization_key=generate_normalization_key("Different Name A"),
        row_data=()
    )
    
    poi2 = POI(
        name="Different Name B",
        lat=-25.4, lng=-49.3,
        category="bar",
        overture_id="same-gers-id",  # SAME ID
        house_number="102",  # Different address!
        postal_code="80100",  # Different postal!
        relevance_score=120,
        normalization_key=generate_normalization_key("Different Name B"),
        row_data=()
    )
    
    # Should merge (same GERS ID overrides everything)
    assert are_same_entity(poi1, poi2, use_fuzzy_tiebreak=True)
    print("  ✅ Same GERS ID → merge (overrides name + address)")
    
    print()


def test_address_disambiguation():
    """Test that address prevents merging of similar names."""
    print("🧪 Test 6: Address Disambiguation")
    
    # Same name, different addresses
    store1 = POI(
        name="Padaria Central",
        lat=-25.4, lng=-49.3,
        category="bakery",
        overture_id="store1-123",
        house_number="100",
        postal_code="80000",
        relevance_score=100,
        normalization_key=generate_normalization_key("Padaria Central"),
        row_data=()
    )
    
    store2 = POI(
        name="Padaria Central",
        lat=-25.4001, lng=-49.3001,  # 50m away
        category="bakery",
        overture_id="store2-456",
        house_number="200",  # Different house number!
        postal_code="80000",
        relevance_score=120,
        normalization_key=generate_normalization_key("Padaria Central"),
        row_data=()
    )
    
    # Should NOT merge (different addresses)
    assert not are_same_entity(store1, store2, use_fuzzy_tiebreak=True)
    print("  ✅ 'Padaria Central #100' ≠ 'Padaria Central #200' (chain stores)")
    
    print()


if __name__ == "__main__":
    print("=" * 60)
    print("Entity Resolution - Regression Test Suite")
    print("=" * 60)
    print()
    
    test_normalization_key()
    test_address_anchoring()
    test_parque_barigui_vs_bacacheri()
    test_parque_barigui_variations()
    test_gers_id_priority()
    test_address_disambiguation()
    
    print("=" * 60)
    print(" ALL TESTS PASSED")
    print("=" * 60)
