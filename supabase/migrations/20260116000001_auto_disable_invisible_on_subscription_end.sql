-- Auto-disable invisible mode when premium subscription expires or is cancelled
-- This ensures users cannot remain invisible after losing premium status

-- Function to disable invisible mode when subscription becomes inactive
CREATE OR REPLACE FUNCTION disable_invisible_on_subscription_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Disable invisible mode for this user
  -- (Trigger WHEN clause ensures this only runs when status changes to non-active)
  UPDATE profiles
  SET is_invisible = false
  WHERE id = NEW.user_id
    AND is_invisible = true; -- Only update if it's currently enabled
  
  -- Log for debugging (optional, can be removed in production)
  RAISE NOTICE 'Disabled invisible mode for user % (subscription status changed to: %)', 
    NEW.user_id, NEW.status;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_subscriptions table
DROP TRIGGER IF EXISTS trigger_disable_invisible_on_subscription_end ON user_subscriptions;

CREATE TRIGGER trigger_disable_invisible_on_subscription_end
  AFTER UPDATE OF status ON user_subscriptions
  FOR EACH ROW
  WHEN (OLD.status = 'active' AND NEW.status != 'active')
  EXECUTE FUNCTION disable_invisible_on_subscription_end();

-- Comment for documentation
COMMENT ON FUNCTION disable_invisible_on_subscription_end() IS 
  'Automatically disables invisible mode when user subscription status changes from active to inactive';
