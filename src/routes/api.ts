import express, { Request, Response } from 'express';
import { getIgClient, closeIgClient, scrapeFollowersHandler } from '../client/Instagram';
import logger from '../config/logger';
import mongoose from 'mongoose';
import { signToken, verifyToken, getTokenFromRequest } from '../secret';
import fs from 'fs/promises';
import path from 'path';
import { getShouldExitInteractions, resetExitInteractions } from '../api/agent';
import agentRoutes from '../api/agent';
import { Comment } from '../types/comment';
import { TargetAccounts } from '../types/targetAccounts';
import { followUnfollowService, FollowCampaignConfig } from '../services/followUnfollowService';

const router = express.Router();

// JWT Auth middleware
function requireAuth(req: Request, res: Response, next: Function) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const payload = verifyToken(token);
  if (!payload || typeof payload !== 'object' || !('username' in payload)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  (req as any).user = { username: payload.username };
  next();
}

// Status endpoint
router.get('/status', (_req: Request, res: Response) => {
    const status = {
        dbConnected: mongoose.connection.readyState === 1
    };
    return res.json(status);
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const igClient = await getIgClient(username, password);
    // Sign JWT and set as httpOnly cookie
    const token = signToken({ username });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      secure: process.env.NODE_ENV === 'production',
    });
    return res.json({ message: 'Login successful' });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Auth check endpoint
router.get('/me', (req: Request, res: Response) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const payload = verifyToken(token);
  if (!payload || typeof payload !== 'object' || !('username' in payload)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  return res.json({ username: payload.username });
});

// Endpoint to clear Instagram cookies
router.delete('/clear-cookies', async (req, res) => {
  const cookiesPath = path.join(__dirname, '../../cookies/Instagramcookies.json');
  try {
    await fs.unlink(cookiesPath);
    res.json({ success: true, message: 'Instagram cookies cleared.' });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.json({ success: true, message: 'No cookies to clear.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to clear cookies.', error: err.message });
    }
  }
});

// All routes below require authentication
router.use(requireAuth);

// Interact with posts endpoint
router.post('/interact', async (req: Request, res: Response) => {
  try {
    // Reset exit flag when starting new interactions
    resetExitInteractions();
    const igClient = await getIgClient((req as any).user.username);
    await igClient.interactWithPosts();
    return res.json({ message: 'Interaction successful' });
  } catch (error) {
    logger.error('Interaction error:', error);
    return res.status(500).json({ error: 'Failed to interact with posts' });
  }
});

// Send direct message endpoint
router.post('/dm', async (req: Request, res: Response) => {
  try {
    const { username, message } = req.body;
    if (!username || !message) {
      return res.status(400).json({ error: 'Username and message are required' });
    }
    const igClient = await getIgClient((req as any).user.username);
    await igClient.sendDirectMessage(username, message);
    return res.json({ message: 'Message sent successfully' });
  } catch (error) {
    logger.error('DM error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send messages from file endpoint
router.post('/dm-file', async (req: Request, res: Response) => {
  try {
    const { file, message, mediaPath } = req.body;
    if (!file || !message) {
      return res.status(400).json({ error: 'File and message are required' });
    }
    const igClient = await getIgClient((req as any).user.username);
    await igClient.sendDirectMessagesFromFile(file, message, mediaPath);
    return res.json({ message: 'Messages sent successfully' });
  } catch (error) {
    logger.error('File DM error:', error);
    return res.status(500).json({ error: 'Failed to send messages from file' });
  }
});

// Scrape followers endpoint
router.post('/scrape-followers', async (req: Request, res: Response) => {
  const { targetAccount, maxFollowers } = req.body;
  try {
    const username = (req as any).user.username;
    const igClient = await getIgClient(username);
    const result = await igClient.scrapeFollowers(targetAccount, maxFollowers);
    if (Array.isArray(result)) {
      if (req.query.download === '1') {
        const filename = `${targetAccount}_followers.txt`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/plain');
        res.send(result.join('\n'));
      } else {
        res.json({ success: true, followers: result });
      }
    } else {
      res.json({ success: true, result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET handler for scrape-followers to support file download
router.get('/scrape-followers', async (req: Request, res: Response) => {
  const { targetAccount, maxFollowers } = req.query;
  try {
    const username = (req as any).user.username;
    const igClient = await getIgClient(username);
    const result = await igClient.scrapeFollowers(
      String(targetAccount),
      Number(maxFollowers)
    );
    if (Array.isArray(result)) {
      const filename = `${targetAccount}_followers.txt`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/plain');
      res.send(result.join('\n'));
    } else {
      res.status(400).send('No followers found.');
    }
  } catch (error) {
    res.status(500).send('Error scraping followers.');
  }
});

// Exit endpoint
router.post('/exit', async (_req: Request, res: Response) => {
  try {
    await closeIgClient();
    return res.json({ message: 'Exiting successfully' });
  } catch (error) {
    logger.error('Exit error:', error);
    return res.status(500).json({ error: 'Failed to exit gracefully' });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res.json({ message: 'Logged out successfully' });
});

// Get comment history endpoint
router.get('/comments', async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    const { limit = 100, skip = 0, includeDeleted = false } = req.query;
    
    const query: any = { username };
    if (includeDeleted !== 'true') {
      query.isDeleted = false;
    }
    
    const comments = await Comment.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();
    
    const total = await Comment.countDocuments(query);
    
    return res.json({
      success: true,
      comments,
      total,
      limit: Number(limit),
      skip: Number(skip)
    });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete comment endpoint
router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const username = (req as any).user.username;
    
    // Find the comment
    const comment = await Comment.findOne({ _id: commentId, username });
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment.isDeleted) {
      return res.status(400).json({ error: 'Comment already deleted' });
    }
    
    // Get IG client and delete the comment
    const igClient = await getIgClient(username);
    await igClient.deleteComment(comment.postUrl, comment.commentText);
    
    // Update the comment in the database
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();
    
    return res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    return res.status(500).json({ error: 'Failed to delete comment: ' + (error as Error).message });
  }
});

// Get comment statistics endpoint
router.get('/comments/stats', async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    logger.info(`Fetching comment stats for username: ${username}`);
    
    const totalComments = await Comment.countDocuments({ username, isDeleted: false });
    const deletedComments = await Comment.countDocuments({ username, isDeleted: true });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const commentsToday = await Comment.countDocuments({
      username,
      isDeleted: false,
      timestamp: { $gte: today }
    });
    
    logger.info(`Comment stats for ${username}: total=${totalComments}, deleted=${deletedComments}, today=${commentsToday}`);
    
    return res.json({
      success: true,
      stats: {
        total: totalComments,
        deleted: deletedComments,
        today: commentsToday
      }
    });
  } catch (error) {
    logger.error('Error fetching comment stats:', error);
    return res.status(500).json({ error: 'Failed to fetch comment statistics' });
  }
});

// Scrape following list endpoint
router.get('/following', async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    const { maxFollowing = 100 } = req.query;
    
    // Use the existing IG client (which was initialized during login)
    try {
      const igClient = await getIgClient(username);
      const following = await igClient.scrapeFollowing(Number(maxFollowing));
      
      return res.json({
        success: true,
        following,
        total: following.length
      });
    } catch (clientError) {
      logger.error('Error with existing client, might need re-login:', clientError);
      return res.status(401).json({ 
        error: 'Session expired. Please logout and login again to refresh your session.',
        needsReauth: true 
      });
    }
  } catch (error) {
    logger.error('Error scraping following:', error);
    return res.status(500).json({ error: 'Failed to scrape following list' });
  }
});

// Get target accounts endpoint
router.get('/target-accounts', async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    logger.info(`Fetching target accounts for username: ${username}`);
    
    let targetAccounts = await TargetAccounts.findOne({ username });
    logger.info(`Found target accounts in database:`, targetAccounts);
    
    if (!targetAccounts) {
      // Create empty target accounts if doesn't exist
      logger.info(`No target accounts found for ${username}, creating empty record`);
      targetAccounts = await TargetAccounts.create({
        username,
        targetAccounts: []
      });
    }
    
    logger.info(`Returning ${targetAccounts.targetAccounts.length} target accounts for ${username}`);
    return res.json({
      success: true,
      targetAccounts: targetAccounts.targetAccounts
    });
  } catch (error) {
    logger.error('Error fetching target accounts:', error);
    return res.status(500).json({ error: 'Failed to fetch target accounts' });
  }
});

// Update target accounts endpoint
router.post('/target-accounts', async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    const { targetAccounts } = req.body;
    
    logger.info(`Updating target accounts for username: ${username}`);
    logger.info(`Received target accounts:`, targetAccounts);
    
    if (!Array.isArray(targetAccounts)) {
      logger.error('targetAccounts is not an array:', typeof targetAccounts);
      return res.status(400).json({ error: 'targetAccounts must be an array' });
    }
    
    // Update or create target accounts
    const updated = await TargetAccounts.findOneAndUpdate(
      { username },
      { username, targetAccounts },
      { upsert: true, new: true }
    );
    
    logger.info(`Successfully saved ${updated.targetAccounts.length} target accounts for ${username}`);
    logger.info(`Saved target accounts:`, updated.targetAccounts);
    
    return res.json({
      success: true,
      message: 'Target accounts updated successfully',
      targetAccounts: updated.targetAccounts
    });
  } catch (error) {
    logger.error('Error updating target accounts:', error);
    return res.status(500).json({ error: 'Failed to update target accounts' });
  }
});

// Follow/Unfollow endpoints

// Start follow campaign
router.post('/follow-campaign/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    const config: FollowCampaignConfig = {
      targetAccounts: req.body.targetAccounts || [],
      maxFollowsPerDay: req.body.maxFollowsPerDay || 50,
      maxFollowsPerSession: req.body.maxFollowsPerSession || 20,
      unfollowAfterDays: req.body.unfollowAfterDays || 3,
      onlyUnfollowNonFollowers: req.body.onlyUnfollowNonFollowers !== false,
      delayBetweenFollows: req.body.delayBetweenFollows || { min: 30, max: 60 },
      skipIfAlreadyFollowing: req.body.skipIfAlreadyFollowing !== false,
    };

    // Load existing data from database
    await followUnfollowService.loadFromDatabase();

    // Check if already running
    if (followUnfollowService.getRunning()) {
      return res.status(400).json({ error: 'Follow campaign is already running' });
    }

    // Check daily limit
    if (followUnfollowService.hasHitDailyLimit(config.maxFollowsPerDay)) {
      return res.status(400).json({ 
        error: `Daily limit of ${config.maxFollowsPerDay} follows already reached. Try again tomorrow.` 
      });
    }

    // Validate target accounts
    if (!config.targetAccounts || config.targetAccounts.length === 0) {
      return res.status(400).json({ 
        error: 'No target accounts specified. Please set target accounts first in the Target Accounts page.' 
      });
    }

    logger.info(`Starting follow campaign with ${config.targetAccounts.length} target accounts`);

    followUnfollowService.setRunning(true);

    // Run campaign in background
    (async () => {
      try {
        const igClient = await getIgClient(username);
        let followedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        // Get users from target accounts
        for (const targetAccount of config.targetAccounts) {
          if (followUnfollowService.shouldStopCampaign()) {
            logger.info('Follow campaign stopped by user');
            break;
          }

          if (followedCount >= config.maxFollowsPerSession) {
            logger.info(`Reached session limit of ${config.maxFollowsPerSession} follows`);
            break;
          }

          if (followUnfollowService.hasHitDailyLimit(config.maxFollowsPerDay)) {
            logger.info(`Reached daily limit of ${config.maxFollowsPerDay} follows`);
            break;
          }

          logger.info(`Scraping followers from @${targetAccount}...`);
          const followers = await igClient.scrapeFollowers(targetAccount, 100);

          for (const followerUsername of followers) {
            if (followUnfollowService.shouldStopCampaign()) break;
            if (followedCount >= config.maxFollowsPerSession) break;
            if (followUnfollowService.hasHitDailyLimit(config.maxFollowsPerDay)) break;

            // Skip if already followed
            if (config.skipIfAlreadyFollowing && followUnfollowService.isUserFollowed(followerUsername)) {
              logger.info(`Skipping @${followerUsername} - already followed before`);
              skippedCount++;
              continue;
            }

            try {
              // Follow the user
              const success = await igClient.followUser(followerUsername);
              
              if (success) {
                await followUnfollowService.addFollowedUser(followerUsername, targetAccount);
                followedCount++;
                logger.info(`✓ Followed @${followerUsername} (${followedCount}/${config.maxFollowsPerSession})`);

                // Random delay between follows
                if (followedCount < config.maxFollowsPerSession) {
                  const delay = followUnfollowService.getRandomDelay(
                    config.delayBetweenFollows.min * 1000,
                    config.delayBetweenFollows.max * 1000
                  );
                  logger.info(`Waiting ${(delay / 1000).toFixed(1)} seconds before next follow...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              } else {
                skippedCount++;
              }
            } catch (error) {
              failedCount++;
              logger.error(`Failed to follow @${followerUsername}:`, error);
            }
          }
        }

        logger.info(`Follow campaign completed. Followed: ${followedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
      } catch (error) {
        logger.error('Error in follow campaign:', error);
      } finally {
        followUnfollowService.setRunning(false);
      }
    })();

    return res.json({
      success: true,
      message: 'Follow campaign started',
      config
    });
  } catch (error) {
    logger.error('Error starting follow campaign:', error);
    followUnfollowService.setRunning(false);
    return res.status(500).json({ error: 'Failed to start follow campaign' });
  }
});

// Stop follow campaign
router.post('/follow-campaign/stop', requireAuth, async (_req: Request, res: Response) => {
  try {
    followUnfollowService.requestStop();
    return res.json({
      success: true,
      message: 'Stop requested for follow campaign'
    });
  } catch (error) {
    logger.error('Error stopping follow campaign:', error);
    return res.status(500).json({ error: 'Failed to stop follow campaign' });
  }
});

// Start unfollow campaign
router.post('/unfollow-campaign/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    const config: FollowCampaignConfig = {
      targetAccounts: [],
      maxFollowsPerDay: 50,
      maxFollowsPerSession: req.body.maxUnfollowsPerSession || 30,
      unfollowAfterDays: req.body.unfollowAfterDays || 3,
      onlyUnfollowNonFollowers: req.body.onlyUnfollowNonFollowers !== false,
      delayBetweenFollows: req.body.delayBetweenUnfollows || { min: 20, max: 40 },
      skipIfAlreadyFollowing: false,
    };

    // Load data from database first
    await followUnfollowService.loadFromDatabase();

    // Get users to unfollow
    const usersToUnfollow = followUnfollowService.getUsersToUnfollow(config);

    logger.info(`Found ${usersToUnfollow.length} users eligible for unfollowing`);

    if (usersToUnfollow.length === 0) {
      return res.json({
        success: true,
        message: 'No users to unfollow at this time. Either no users were followed yet, or all followed users have been unfollowed, or they are still within the waiting period.',
        unfollowed: 0
      });
    }

    // Run unfollow in background
    (async () => {
      try {
        const igClient = await getIgClient(username);
        let unfollowedCount = 0;
        const maxToUnfollow = Math.min(usersToUnfollow.length, config.maxFollowsPerSession);

        for (const user of usersToUnfollow.slice(0, maxToUnfollow)) {
          if (followUnfollowService.shouldStopCampaign()) {
            logger.info('Unfollow campaign stopped by user');
            break;
          }

          try {
            const success = await igClient.unfollowUser(user.username);
            
            if (success) {
              await followUnfollowService.markAsUnfollowed(user.username);
              unfollowedCount++;
              logger.info(`✓ Unfollowed @${user.username} (${unfollowedCount}/${maxToUnfollow})`);

              // Random delay between unfollows
              if (unfollowedCount < maxToUnfollow) {
                const delay = followUnfollowService.getRandomDelay(
                  config.delayBetweenFollows.min * 1000,
                  config.delayBetweenFollows.max * 1000
                );
                logger.info(`Waiting ${(delay / 1000).toFixed(1)} seconds before next unfollow...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          } catch (error) {
            logger.error(`Failed to unfollow @${user.username}:`, error);
          }
        }

        logger.info(`Unfollow campaign completed. Unfollowed: ${unfollowedCount}`);
      } catch (error) {
        logger.error('Error in unfollow campaign:', error);
      }
    })();

    return res.json({
      success: true,
      message: `Unfollow campaign started for ${usersToUnfollow.length} users`,
      totalToUnfollow: usersToUnfollow.length
    });
  } catch (error) {
    logger.error('Error starting unfollow campaign:', error);
    return res.status(500).json({ error: 'Failed to start unfollow campaign' });
  }
});

// Check follow-back status for followed users
router.post('/follow-campaign/check-followbacks', requireAuth, async (req: Request, res: Response) => {
  try {
    const username = (req as any).user.username;
    const { maxToCheck = 20 } = req.body;

    // Get followed users who haven't been checked recently
    const followedUsers = followUnfollowService.getAllFollowedUsers()
      .filter(user => !user.unfollowedAt)
      .slice(0, maxToCheck);

    if (followedUsers.length === 0) {
      return res.json({
        success: true,
        message: 'No users to check',
        checked: 0,
        followedBack: 0
      });
    }

    // Check in background
    (async () => {
      try {
        const igClient = await getIgClient(username);
        let checkedCount = 0;
        let followBackCount = 0;

        for (const user of followedUsers) {
          try {
            const followsBack = await igClient.checkIfUserFollowsBack(user.username);
            await followUnfollowService.updateFollowBackStatus(user.username, followsBack);
            
            if (followsBack) {
              followBackCount++;
              logger.info(`✓ @${user.username} follows back!`);
            }
            
            checkedCount++;
            
            // Delay between checks
            if (checkedCount < followedUsers.length) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error) {
            logger.error(`Failed to check follow-back for @${user.username}:`, error);
          }
        }

        logger.info(`Follow-back check completed. Checked: ${checkedCount}, Followed back: ${followBackCount}`);
      } catch (error) {
        logger.error('Error checking follow-backs:', error);
      }
    })();

    return res.json({
      success: true,
      message: `Started checking follow-back status for ${followedUsers.length} users`
    });
  } catch (error) {
    logger.error('Error checking follow-backs:', error);
    return res.status(500).json({ error: 'Failed to check follow-backs' });
  }
});

// Get follow/unfollow statistics
router.get('/follow-stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    await followUnfollowService.loadFromDatabase();
    const stats = await followUnfollowService.getStatsFromDatabase();
    
    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting follow stats:', error);
    return res.status(500).json({ error: 'Failed to get follow statistics' });
  }
});

// Get followed users list
router.get('/followed-users', requireAuth, async (req: Request, res: Response) => {
  try {
    const { filter = 'all', limit = 50 } = req.query;
    
    await followUnfollowService.loadFromDatabase();
    let users = followUnfollowService.getAllFollowedUsers();

    // Apply filters
    if (filter === 'active') {
      users = users.filter(u => !u.unfollowedAt);
    } else if (filter === 'unfollowed') {
      users = users.filter(u => u.unfollowedAt);
    } else if (filter === 'followed-back') {
      users = users.filter(u => u.followedBack && !u.unfollowedAt);
    } else if (filter === 'not-followed-back') {
      users = users.filter(u => !u.followedBack && !u.unfollowedAt);
    }

    // Sort by most recent
    users.sort((a, b) => b.followedAt.getTime() - a.followedAt.getTime());

    // Limit results
    users = users.slice(0, Number(limit));

    return res.json({
      success: true,
      users,
      total: users.length
    });
  } catch (error) {
    logger.error('Error getting followed users:', error);
    return res.status(500).json({ error: 'Failed to get followed users' });
  }
});

// Mount agent routes
router.use('/', agentRoutes);

export default router; 