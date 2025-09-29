import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useListings, useSearchListings } from '@/hooks/useMarketplaceService';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ListingCardProps {
  listing: any;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const colorScheme = useColorScheme();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <View style={[styles.listingCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      {listing.images && listing.images.length > 0 && (
        <Image source={{ uri: listing.images[0] }} style={styles.listingImage} />
      )}

      <View style={styles.listingContent}>
        <View style={styles.listingHeader}>
          <Text style={[styles.listingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            {listing.title}
          </Text>
          <Text style={[styles.listingPrice, { color: Colors[colorScheme ?? 'light'].tint }]}>
            {formatPrice(listing.price)}
          </Text>
        </View>

        <Text style={[styles.listingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
          {listing.description}
        </Text>

        <View style={styles.listingFooter}>
          <View style={styles.listingMeta}>
            <View style={[styles.conditionBadge, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
              <Text style={[styles.conditionText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                {listing.condition}
              </Text>
            </View>
            <Text style={[styles.listingTime, { color: Colors[colorScheme ?? 'light'].text + '80' }]}>
              {formatTimeAgo(listing.createdAt)}
            </Text>
          </View>

          <TouchableOpacity style={styles.contactButton}>
            <IconSymbol name="bubble.right" size={16} color="#fff" />
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function MarketplaceScreen() {
  const colorScheme = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: listings, isLoading, error, refetch } = useListings({
    status: 'active',
    limit: 20,
  });

  const { data: searchResults, isLoading: searchLoading } = useSearchListings(
    searchQuery,
    20
  );

  const displayListings = searchQuery ? searchResults : listings;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && !listings) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Loading marketplace...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.errorText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Failed to load marketplace
        </Text>
        <Text style={[styles.errorSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
          {error.message}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.searchContainer}>
        <IconSymbol name="magnifyingglass" size={20} color={Colors[colorScheme ?? 'light'].text + '60'} />
        <TextInput
          style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
          placeholder="Search marketplace..."
          placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <IconSymbol name="xmark" size={16} color={Colors[colorScheme ?? 'light'].text + '60'} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={displayListings}
        renderItem={({ item }) => <ListingCard listing={item} />}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={[styles.emptyContainer, styles.centered]}>
            <IconSymbol name="bag" size={48} color={Colors[colorScheme ?? 'light'].text + '40'} />
            <Text style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].text }]}>
              {searchQuery ? 'No items found' : 'No listings available'}
            </Text>
            <Text style={[styles.emptySubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
              {searchQuery ? 'Try a different search term' : 'Be the first to list something'}
            </Text>
          </View>
        }
        contentContainerStyle={!displayListings?.length ? styles.centered : undefined}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    fontSize: 16,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  listingCard: {
    flex: 0.48,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: 120,
  },
  listingContent: {
    padding: 12,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  listingDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
    opacity: 0.8,
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listingMeta: {
    flex: 1,
  },
  conditionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listingTime: {
    fontSize: 10,
  },
  contactButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});