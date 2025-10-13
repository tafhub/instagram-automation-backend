import logger from "../config/logger";
import { FollowedUser as FollowedUserModel, IFollowedUser } from "../types/followedUser";

export interface FollowedUser {
    username: string;
    followedAt: Date;
    unfollowedAt?: Date;
    followedBack: boolean;
    shouldUnfollow: boolean;
    sourceAccount?: string; // Which target account we found them from
    notes?: string;
}

export interface FollowUnfollowStats {
    totalFollowed: number;
    totalUnfollowed: number;
    followedBack: number;
    pendingUnfollow: number;
    todayFollowed: number;
    todayUnfollowed: number;
    conversionRate: number; // Percentage who followed back
}

export interface FollowCampaignConfig {
    targetAccounts: string[];
    maxFollowsPerDay: number;
    maxFollowsPerSession: number;
    unfollowAfterDays: number;
    onlyUnfollowNonFollowers: boolean;
    delayBetweenFollows: { min: number; max: number }; // in seconds
    skipIfAlreadyFollowing: boolean;
}

class FollowUnfollowService {
    private followedUsers: Map<string, FollowedUser> = new Map();
    private isRunning: boolean = false;
    private shouldStop: boolean = false;

    /**
     * Check if user is in our followed list
     */
    isUserFollowed(username: string): boolean {
        return this.followedUsers.has(username.toLowerCase());
    }

    /**
     * Add user to followed list
     */
    async addFollowedUser(username: string, sourceAccount?: string, campaignId?: string): Promise<void> {
        const user: FollowedUser = {
            username,
            followedAt: new Date(),
            followedBack: false,
            shouldUnfollow: false,
            sourceAccount,
        };
        this.followedUsers.set(username.toLowerCase(), user);
        
        // Save to database
        try {
            await FollowedUserModel.findOneAndUpdate(
                { username: username.toLowerCase() },
                {
                    username: username.toLowerCase(),
                    followedAt: user.followedAt,
                    followedBack: false,
                    shouldUnfollow: false,
                    sourceAccount,
                    campaignId
                },
                { upsert: true, new: true }
            );
            logger.info(`Added ${username} to followed users list and database`);
        } catch (error) {
            logger.error(`Failed to save followed user to database:`, error);
        }
    }

    /**
     * Mark user as unfollowed
     */
    async markAsUnfollowed(username: string): Promise<void> {
        const user = this.followedUsers.get(username.toLowerCase());
        if (user) {
            user.unfollowedAt = new Date();
            user.shouldUnfollow = false;
            
            // Update in database
            try {
                await FollowedUserModel.findOneAndUpdate(
                    { username: username.toLowerCase() },
                    { 
                        unfollowedAt: user.unfollowedAt,
                        shouldUnfollow: false
                    }
                );
                logger.info(`Marked ${username} as unfollowed in memory and database`);
            } catch (error) {
                logger.error(`Failed to update unfollow in database:`, error);
            }
        }
    }

    /**
     * Update follow-back status
     */
    async updateFollowBackStatus(username: string, followedBack: boolean): Promise<void> {
        const user = this.followedUsers.get(username.toLowerCase());
        if (user) {
            user.followedBack = followedBack;
            
            // Update in database
            try {
                await FollowedUserModel.findOneAndUpdate(
                    { username: username.toLowerCase() },
                    { 
                        followedBack,
                        followBackCheckedAt: new Date()
                    }
                );
                logger.info(`Updated ${username} follow-back status: ${followedBack}`);
            } catch (error) {
                logger.error(`Failed to update follow-back status in database:`, error);
            }
        }
    }

    /**
     * Get users who should be unfollowed based on config
     */
    getUsersToUnfollow(config: FollowCampaignConfig): FollowedUser[] {
        const now = new Date();
        const unfollowThreshold = config.unfollowAfterDays * 24 * 60 * 60 * 1000;
        
        const usersToUnfollow: FollowedUser[] = [];

        for (const user of this.followedUsers.values()) {
            // Skip if already unfollowed
            if (user.unfollowedAt) continue;

            // Check if enough time has passed
            const timeSinceFollow = now.getTime() - user.followedAt.getTime();
            if (timeSinceFollow < unfollowThreshold) continue;

            // If config says only unfollow non-followers
            if (config.onlyUnfollowNonFollowers && user.followedBack) continue;

            usersToUnfollow.push(user);
        }

        return usersToUnfollow;
    }

    /**
     * Get statistics
     */
    getStats(): FollowUnfollowStats {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let totalFollowed = 0;
        let totalUnfollowed = 0;
        let followedBack = 0;
        let todayFollowed = 0;
        let todayUnfollowed = 0;

        for (const user of this.followedUsers.values()) {
            totalFollowed++;
            
            if (user.followedBack) {
                followedBack++;
            }

            if (user.unfollowedAt) {
                totalUnfollowed++;
                if (user.unfollowedAt >= todayStart) {
                    todayUnfollowed++;
                }
            }

            if (user.followedAt >= todayStart && !user.unfollowedAt) {
                todayFollowed++;
            }
        }

        const conversionRate = totalFollowed > 0 
            ? Math.round((followedBack / totalFollowed) * 100) 
            : 0;

        return {
            totalFollowed,
            totalUnfollowed,
            followedBack,
            pendingUnfollow: totalFollowed - totalUnfollowed,
            todayFollowed,
            todayUnfollowed,
            conversionRate,
        };
    }

    /**
     * Get all followed users
     */
    getAllFollowedUsers(): FollowedUser[] {
        return Array.from(this.followedUsers.values());
    }

    /**
     * Get users followed today
     */
    getTodayFollowedUsers(): FollowedUser[] {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        return Array.from(this.followedUsers.values()).filter(
            user => user.followedAt >= todayStart && !user.unfollowedAt
        );
    }

    /**
     * Check if we've hit daily limit
     */
    hasHitDailyLimit(maxPerDay: number): boolean {
        const todayFollowed = this.getTodayFollowedUsers().length;
        return todayFollowed >= maxPerDay;
    }

    /**
     * Clear history (use with caution!)
     */
    clearHistory(): void {
        this.followedUsers.clear();
        logger.info('Cleared follow/unfollow history');
    }

    /**
     * Export data for persistence
     */
    exportData(): FollowedUser[] {
        return Array.from(this.followedUsers.values());
    }

    /**
     * Import data from persistence
     */
    importData(users: FollowedUser[]): void {
        this.followedUsers.clear();
        users.forEach(user => {
            // Convert string dates back to Date objects
            user.followedAt = new Date(user.followedAt);
            if (user.unfollowedAt) {
                user.unfollowedAt = new Date(user.unfollowedAt);
            }
            this.followedUsers.set(user.username.toLowerCase(), user);
        });
        logger.info(`Imported ${users.length} followed users from storage`);
    }

    /**
     * Load data from database on startup
     */
    async loadFromDatabase(): Promise<void> {
        try {
            const users = await FollowedUserModel.find().lean();
            this.followedUsers.clear();
            
            users.forEach((user: any) => {
                const followedUser: FollowedUser = {
                    username: user.username,
                    followedAt: new Date(user.followedAt),
                    unfollowedAt: user.unfollowedAt ? new Date(user.unfollowedAt) : undefined,
                    followedBack: user.followedBack,
                    shouldUnfollow: user.shouldUnfollow,
                    sourceAccount: user.sourceAccount,
                    notes: user.notes
                };
                this.followedUsers.set(user.username.toLowerCase(), followedUser);
            });
            
            logger.info(`Loaded ${users.length} followed users from database`);
        } catch (error) {
            logger.error('Failed to load followed users from database:', error);
        }
    }

    /**
     * Get stats from database (more accurate than in-memory)
     */
    async getStatsFromDatabase(): Promise<FollowUnfollowStats> {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const [
                totalFollowed,
                totalUnfollowed,
                followedBack,
                todayFollowed,
                todayUnfollowed
            ] = await Promise.all([
                FollowedUserModel.countDocuments(),
                FollowedUserModel.countDocuments({ unfollowedAt: { $exists: true } }),
                FollowedUserModel.countDocuments({ followedBack: true }),
                FollowedUserModel.countDocuments({ 
                    followedAt: { $gte: todayStart },
                    unfollowedAt: { $exists: false }
                }),
                FollowedUserModel.countDocuments({ 
                    unfollowedAt: { $gte: todayStart }
                })
            ]);

            const conversionRate = totalFollowed > 0 
                ? Math.round((followedBack / totalFollowed) * 100) 
                : 0;

            return {
                totalFollowed,
                totalUnfollowed,
                followedBack,
                pendingUnfollow: totalFollowed - totalUnfollowed,
                todayFollowed,
                todayUnfollowed,
                conversionRate,
            };
        } catch (error) {
            logger.error('Failed to get stats from database:', error);
            return this.getStats(); // Fallback to in-memory stats
        }
    }

    /**
     * Set running state
     */
    setRunning(running: boolean): void {
        this.isRunning = running;
        if (!running) {
            this.shouldStop = false;
        }
    }

    /**
     * Get running state
     */
    getRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Request stop
     */
    requestStop(): void {
        this.shouldStop = true;
        logger.info('Stop requested for follow/unfollow campaign');
    }

    /**
     * Check if should stop
     */
    shouldStopCampaign(): boolean {
        return this.shouldStop;
    }

    /**
     * Generate random delay within range
     */
    getRandomDelay(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

export const followUnfollowService = new FollowUnfollowService();

