import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FeedItem as FeedItemType } from '@/hooks/useFeedService';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface FeedItemProps {
  item: FeedItemType;
}

export const FeedItem: React.FC<FeedItemProps> = ({ item }) => {
  const colorScheme = useColorScheme();

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getItemIcon = () => {
    switch (item.type) {
      case 'post':
        return 'doc.text.fill';
      case 'group':
        return 'person.3.fill';
      case 'friend':
        return 'person.wave.2.fill';
      default:
        return 'circle.fill';
    }
  };

  return (
    <View style={[styles.container, { borderBottomColor: Colors[colorScheme ?? 'light'].text + '20' }]}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <IconSymbol name={getItemIcon()} size={20} color={Colors[colorScheme ?? 'light'].tint} />
          <Text style={[styles.username, { color: Colors[colorScheme ?? 'light'].text }]}>
            {item.username || 'Unknown User'}
          </Text>
          {item.groupName && (
            <>
              <Text style={[styles.separator, { color: Colors[colorScheme ?? 'light'].text }]}>•</Text>
              <Text style={[styles.groupName, { color: Colors[colorScheme ?? 'light'].text }]}>
                {item.groupName}
              </Text>
            </>
          )}
        </View>
        <Text style={[styles.timestamp, { color: Colors[colorScheme ?? 'light'].text + '80' }]}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>

      {item.content && (
        <Text style={[styles.content, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.content}
        </Text>
      )}

      {item.metadata && Object.keys(item.metadata).length > 0 && (
        <View style={styles.metadata}>
          {item.metadata.image && (
            <Image source={{ uri: item.metadata.image }} style={styles.metadataImage} />
          )}
          {item.metadata.preview && (
            <Text style={[styles.preview, { color: Colors[colorScheme ?? 'light'].text + '80' }]}>
              {item.metadata.preview}
            </Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <IconSymbol name="heart" size={18} color={Colors[colorScheme ?? 'light'].text + '60'} />
          <Text style={[styles.actionText, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
            Like
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <IconSymbol name="bubble.right" size={18} color={Colors[colorScheme ?? 'light'].text + '60'} />
          <Text style={[styles.actionText, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
            Comment
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <IconSymbol name="square.and.arrow.up" size={18} color={Colors[colorScheme ?? 'light'].text + '60'} />
          <Text style={[styles.actionText, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
            Share
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  separator: {
    marginHorizontal: 8,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  metadata: {
    marginBottom: 12,
  },
  metadataImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
    marginLeft: 4,
  },
});