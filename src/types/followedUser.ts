import mongoose from 'mongoose';

export interface IFollowedUser {
    username: string;
    followedAt: Date;
    unfollowedAt?: Date;
    followedBack: boolean;
    followBackCheckedAt?: Date;
    shouldUnfollow: boolean;
    sourceAccount?: string; // Which target account we found them from
    notes?: string;
    campaignId?: string;
}

const followedUserSchema = new mongoose.Schema<IFollowedUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    followedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    unfollowedAt: {
        type: Date,
        index: true
    },
    followedBack: {
        type: Boolean,
        default: false,
        index: true
    },
    followBackCheckedAt: {
        type: Date
    },
    shouldUnfollow: {
        type: Boolean,
        default: false,
        index: true
    },
    sourceAccount: {
        type: String,
        index: true
    },
    notes: {
        type: String
    },
    campaignId: {
        type: String,
        index: true
    }
}, {
    timestamps: true,
    collection: 'followed_users'
});

// Index for efficient queries
followedUserSchema.index({ followedAt: -1 });
followedUserSchema.index({ unfollowedAt: -1 });
followedUserSchema.index({ followedBack: 1, unfollowedAt: 1 });

export const FollowedUser = mongoose.model<IFollowedUser>('FollowedUser', followedUserSchema);



