import { ActionButton } from "@/components/ui/action-button";
import { useIAP } from "@/modules/iap/hooks";
import { default as React } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function IAPDebugScreen() {
  const {
    connected,
    loading,
    products,
    subscriptions,
    requestPurchase,
    requestSubscription,
    restorePurchases,
    error,
    refreshProducts,
  } = useIAP();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>IAP Debugger</Text>

        <View style={styles.statusContainer}>
          <Text>Status: {connected ? "Connected ✅" : "Disconnected ❌"}</Text>
          <Text>Loading: {loading ? "Yes" : "No"}</Text>
          {error && <Text style={styles.error}>Error: {error}</Text>}
        </View>

        <ActionButton
          label="Refresh"
          onPress={refreshProducts}
          ariaLabel="Refresh"
          variant="default"
        />

        <Text style={styles.sectionTitle}>Subscriptions</Text>
        {subscriptions.length === 0 ? (
          <Text>No subscriptions found (check config)</Text>
        ) : (
          subscriptions.map((sub) => (
            <View key={sub.productId} style={styles.item}>
              <Text style={styles.itemTitle}>{sub.title}</Text>
              <Text>{sub.productId}</Text>
              <Text>{sub.localizedPrice}</Text>
              <ActionButton
                label="Subscribe"
                onPress={() => requestSubscription(sub.productId)}
                ariaLabel="Subscribe"
                size="sm"
                variant="accent"
              />
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Consumables</Text>
        {products.length === 0 ? (
          <Text>No consumables found (check config)</Text>
        ) : (
          products.map((prod) => (
            <View key={prod.productId} style={styles.item}>
              <Text style={styles.itemTitle}>{prod.title}</Text>
              <Text>{prod.productId}</Text>
              <Text>{prod.localizedPrice}</Text>
              <ActionButton
                label="Buy"
                onPress={() => requestPurchase(prod.productId)}
                ariaLabel="Buy"
                size="sm"
                variant="default"
              />
            </View>
          ))
        )}

        <View style={styles.footer}>
          <ActionButton
            label="Restore Purchases"
            onPress={restorePurchases}
            ariaLabel="Restore"
            variant="default"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statusContainer: {
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  error: {
    color: "red",
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  item: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    gap: 5,
  },
  itemTitle: {
    fontWeight: "600",
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
});
