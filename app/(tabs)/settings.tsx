import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useTheme } from '../../kernel/theme';
import { useAuthStore } from '../../kernel/stores/auth';
import { useDebugStore } from '../../kernel/stores/debug';
import { useNetworkStatus } from '../../kernel/hooks/useNetworkStatus';
import { useOfflineQueue } from '../../kernel/hooks/useOfflineQueue';
import { colors, spacing, borderRadius } from '../../kernel/theme/tokens';

/**
 * Settings screen — debug controls, theme toggle, logout.
 * 
 * FAULT ISOLATION: The "Crash Sports App" button sets a global flag
 * that causes the Sports screen to throw during render. This demonstrates
 * that the MiniAppErrorBoundary catches the crash while Care and Events
 * continue running.
 */
export default function SettingsScreen(): React.JSX.Element {
  const { theme, toggleTheme, isDark } = useTheme();
  const { user, logout } = useAuthStore();
  const { isConnected } = useNetworkStatus();
  const { shouldCrashSports, triggerSportsCrash, resetSportsCrash } = useDebugStore();
  const { items: queueItems, pendingCount, hasConflicts } = useOfflineQueue();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.header, { color: theme.text }]}>Settings</Text>

      {/* Account Section */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ACCOUNT</Text>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary[500] + '30' }]}>
            <Text style={{ fontSize: 24 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {user?.displayName ?? 'Unknown User'}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.primary[500] + '20' }]}>
              <Text style={{ color: colors.primary[400], fontSize: 11, fontWeight: '600' }}>
                {user?.role}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.dangerButton, { backgroundColor: colors.error.main }]}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>PREFERENCES</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Dark Mode</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {isDark ? 'Dark theme active' : 'Light theme active'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.primary[500] + '60' }}
            thumbColor={isDark ? colors.primary[400] : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Network & Offline Queue */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>NETWORK & SYNC</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success.main : colors.error.main }]} />
          <Text style={{ color: theme.text, fontSize: 15 }}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>

        <View style={[styles.queueInfo, { borderTopColor: theme.border }]}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
            Offline Queue: {pendingCount} pending
          </Text>
          {hasConflicts && (
            <Text style={{ color: colors.error.main, fontSize: 13, marginTop: 4 }}>
              ⚠️ Some bookings have conflicts
            </Text>
          )}
          {queueItems.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {queueItems.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.queueItem}>
                  <View style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        item.status === 'SUCCESS' ? colors.success.main :
                        item.status === 'CONFLICT_REJECTED' ? colors.error.main :
                        item.status === 'SYNCING' ? colors.warning.main :
                        colors.primary[400],
                    }
                  ]} />
                  <Text style={{ color: theme.textSecondary, fontSize: 12, flex: 1 }}>
                    {item.bookingType} booking · {item.status}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Debug Section */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>DEBUG & DIAGNOSTICS</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>
          Test fault isolation between mini-apps. Crashing Sports should not affect Care or Events.
        </Text>

        {shouldCrashSports ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.success.main }]}
            onPress={resetSportsCrash}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>🔄 Reset Sports Crash Flag</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: colors.error.main + 'DD' }]}
            onPress={triggerSportsCrash}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>💥 Crash Sports App</Text>
          </TouchableOpacity>
        )}

        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
          After crashing, switch to Sports tab to see the ErrorBoundary. Care and Events remain functional.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingTop: 56 },
  header: { fontSize: 28, fontWeight: '700', marginBottom: spacing.lg, letterSpacing: -0.5 },
  section: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  queueInfo: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  button: {
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerButton: {
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
