import * as puppeteer from 'puppeteer';
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import UserAgent from "user-agents";
import { Server } from "proxy-chain";
import { IGpassword, IGusername } from "../../secret";
import logger from "../../config/logger";
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../../utils";
import { runAgent } from "../../Agent";
import { getInstagramCommentSchema } from "../../Agent/schema";
import readline from "readline";
import fs from "fs/promises";
import { getShouldExitInteractions } from '../../api/agent';
import { TargetAccounts } from '../../types/targetAccounts';
import { Comment } from '../../types/comment';

// Add stealth plugin to puppeteer
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(
  AdblockerPlugin({
    // Optionally enable Cooperative Mode for several request interceptors
    interceptResolutionPriority: puppeteer.DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class IgClient {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private username: string;
    private password: string;

    constructor(username?: string, password?: string) {
        this.username = username || '';
        this.password = password || '';
    }

    async init() {
        // Center the window on a 1920x1080 screen
        const width = 1280;
        const height = 800;
        const screenWidth = 1920;
        const screenHeight = 1080;
        const left = Math.floor((screenWidth - width) / 2);
        const top = Math.floor((screenHeight - height) / 2);
        
        // Check if we should connect to a remote Chrome instance
        const remoteChromeUrl = process.env.REMOTE_CHROME_URL; // e.g., "http://YOUR_LOCAL_IP:9222"
        
        if (remoteChromeUrl) {
            logger.info(`Connecting to remote Chrome at ${remoteChromeUrl}`);
            try {
                this.browser = await puppeteerExtra.connect({
                    browserURL: remoteChromeUrl,
                    defaultViewport: { width, height }
                });
                logger.info("Successfully connected to remote Chrome");
            } catch (error) {
                logger.error("Failed to connect to remote Chrome:", error);
                logger.info("Falling back to local browser launch...");
                await this.launchLocalBrowser(width, height, left, top);
            }
        } else {
            await this.launchLocalBrowser(width, height, left, top);
        }
        
        if (!this.browser) {
            throw new Error("Failed to launch or connect to a browser instance");
        }

        this.page = await this.browser!.newPage();
        if (!this.page) {
            throw new Error("Unable to create a new page in the browser");
        }
        const userAgent = new UserAgent({ deviceCategory: "desktop" });
        await this.page.setUserAgent(userAgent.toString());
        await this.page.setViewport({ width, height });

        if (await Instagram_cookiesExist()) {
            await this.loginWithCookies();
        } else {
            await this.loginWithCredentials();
        }
    }

    private async launchLocalBrowser(width: number, height: number, left: number, top: number) {
        // Check if we're running on a server (no display) or locally
        // Allow override with FORCE_HEADLESS environment variable
        const forceHeadless = process.env.FORCE_HEADLESS === 'true';
        const isServer = !process.env.DISPLAY && process.env.NODE_ENV === 'production';
        const shouldRunHeadless = forceHeadless || isServer;
        
        logger.info(`Launching local browser in ${shouldRunHeadless ? 'headless' : 'visible'} mode`);
        
        // Production-ready Chrome arguments
        const chromeArgs = [
            `--window-size=${width},${height}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--disable-translate',
            '--disable-logging',
            '--disable-permissions-api',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-domain-reliability',
            '--disable-client-side-phishing-detection',
            '--disable-component-extensions-with-background-pages',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-features=TranslateUI,BlinkGenPropertyTrees',
            '--force-color-profile=srgb',
            '--metrics-recording-only',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--enable-automation',
            '--password-store=basic',
            '--use-mock-keychain'
        ];

        // Add display argument if running on server with virtual display
        if (shouldRunHeadless && process.env.NODE_ENV === 'production') {
            chromeArgs.push('--display=:99'); // Use virtual display
            logger.info('Using virtual display :99 for headless mode');
        } else if (!shouldRunHeadless) {
            // Only add window positioning for visible mode
            chromeArgs.push(`--window-position=${left},${top}`);
        }
        
        this.browser = await puppeteerExtra.launch({
            headless: shouldRunHeadless,
            args: chromeArgs,
            ignoreDefaultArgs: ['--disable-extensions'],
        });
    }

    private async loginWithCookies() {
        if (!this.page) throw new Error("Page not initialized");
        const cookies = await loadCookies("./cookies/Instagramcookies.json");
        if(cookies.length > 0) {
            await this.page.setCookie(...cookies);
        }
        
        logger.info("Loaded cookies. Navigating to Instagram home page.");
        await this.page.goto("https://www.instagram.com/", {
            waitUntil: "networkidle2",
        });
        const url = this.page.url();
        if (url.includes("/login/")) {
            logger.warn("Cookies are invalid or expired. Falling back to credentials login.");
            await this.loginWithCredentials();
        } else {
            logger.info("Successfully logged in with cookies.");
        }
    }

    private async loginWithCredentials() {
        if (!this.page || !this.browser) throw new Error("Browser/Page not initialized");
        logger.info("Logging in with credentials...");
        await this.page.goto("https://www.instagram.com/accounts/login/", {
            waitUntil: "networkidle2",
        });
        await this.page.waitForSelector('input[name="username"]');
        await this.page.type('input[name="username"]', this.username);
        await this.page.type('input[name="password"]', this.password);
        await this.page.click('button[type="submit"]');
        await this.page.waitForNavigation({ waitUntil: "networkidle2" });
        const cookies = await this.page.cookies();
        await saveCookies("./cookies/Instagramcookies.json", cookies);
        logger.info("Successfully logged in and saved cookies.");
        await this.handleNotificationPopup();
    }

    async handleNotificationPopup() {
        if (!this.page) throw new Error("Page not initialized");
        console.log("Checking for notification popup...");

        try {
            // Wait for the dialog to appear, with a timeout
            const dialogSelector = 'div[role="dialog"]';
            await this.page.waitForSelector(dialogSelector, { timeout: 5000 });
            const dialog = await this.page.$(dialogSelector);

            if (dialog) {
                console.log("Notification dialog found. Searching for 'Not Now' button.");
                const notNowButtonSelectors = ["button", `div[role="button"]`];
                let notNowButton: puppeteer.ElementHandle<Element> | null = null;

                for (const selector of notNowButtonSelectors) {
                    // Search within the dialog context
                    const elements = await dialog.$$(selector);
                    for (const element of elements) {
                        try {
                            const text = await element.evaluate((el) => el.textContent);
                            if (text && text.trim().toLowerCase() === "not now") {
                                notNowButton = element;
                                console.log(`Found 'Not Now' button with selector: ${selector}`);
                                break;
                            }
                        } catch (e) {
                            // Ignore errors from stale elements
                        }
                    }
                    if (notNowButton) break;
                }

                if (notNowButton) {
                    try {
                        console.log("Dismissing 'Not Now' notification popup...");
                        // Using evaluate to click because it can be more reliable
                        await notNowButton.evaluate((btn:any) => btn.click());
                        await delay(1500); // Wait for popup to close
                        console.log("'Not Now' notification popup dismissed.");
                    } catch (e) {
                        console.warn("Failed to click 'Not Now' button. It might be gone or covered.", e);
                    }
                } else {
                    console.log("'Not Now' button not found within the dialog.");
                }
            }
        } catch (error) {
            console.log("No notification popup appeared within the timeout period.");
            // If it times out, it means no popup, which is fine.
        }
    }

    async sendDirectMessage(username: string, message: string) {
        if (!this.page) throw new Error("Page not initialized");
        try {
            await this.sendDirectMessageWithMedia(username, message);
        } catch (error) {
            logger.error("Failed to send direct message", error);
            throw error;
        }
    }

    async sendDirectMessageWithMedia(username: string, message: string, mediaPath?: string) {
        if (!this.page) throw new Error("Page not initialized");
        try {
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: "networkidle2",
            });
            console.log("Navigated to user profile");
            await delay(3000);

            const messageButtonSelectors = ['div[role="button"]', "button", 'a[href*="/direct/t/"]', 'div[role="button"] span', 'div[role="button"] div'];
            let messageButton: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of messageButtonSelectors) {
                const elements = await this.page.$$(selector);
                for (const element of elements) {
                    const text = await element.evaluate((el: Element) => el.textContent);
                    if (text && text.trim() === "Message") {
                        messageButton = element;
                        break;
                    }
                }
                if (messageButton) break;
            }
            if (!messageButton) throw new Error("Message button not found.");
            await messageButton.click();
            await delay(2000); // Wait for message modal to open
            await this.handleNotificationPopup();

            if (mediaPath) {
                const fileInput = await this.page.$('input[type="file"]');
                if (fileInput) {
                    await fileInput.uploadFile(mediaPath);
                    await this.handleNotificationPopup();
                    await delay(2000); // wait for upload
                } else {
                    logger.warn("File input for media not found.");
                }
            }

            const messageInputSelectors = ['textarea[placeholder="Message..."]', 'div[role="textbox"]', 'div[contenteditable="true"]', 'textarea[aria-label="Message"]'];
            let messageInput: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of messageInputSelectors) {
                messageInput = await this.page.$(selector);
                if (messageInput) break;
            }
            if (!messageInput) throw new Error("Message input not found.");
            await messageInput.type(message);
            await this.handleNotificationPopup();
            await delay(2000);

            const sendButtonSelectors = ['div[role="button"]', "button"];
            let sendButton: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of sendButtonSelectors) {
                const elements = await this.page.$$(selector);
                for (const element of elements) {
                    const text = await element.evaluate((el: Element) => el.textContent);
                    if (text && text.trim() === "Send") {
                        sendButton = element;
                        break;
                    }
                }
                if (sendButton) break;
            }
            if (!sendButton) throw new Error("Send button not found.");
            await sendButton.click();
            await this.handleNotificationPopup();
            console.log("Message sent successfully");
        } catch (error) {
            logger.error(`Failed to send DM to ${username}`, error);
            throw error;
        }
    }

    async sendDirectMessagesFromFile(file: Buffer | string, message: string, mediaPath?: string) {
        if (!this.page) throw new Error("Page not initialized");
        logger.info(`Sending DMs from provided file content`);
        let fileContent: string;
        if (Buffer.isBuffer(file)) {
            fileContent = file.toString('utf-8');
        } else {
            fileContent = file;
        }
        const usernames = fileContent.split("\n");
        for (const username of usernames) {
            if (username.trim()) {
                await this.handleNotificationPopup();
                await this.sendDirectMessageWithMedia(username.trim(), message, mediaPath);
                await this.handleNotificationPopup();
                // add delay to avoid being flagged
                await delay(30000);
            }
        }
    }

    async interactWithPosts() {
        if (!this.page) throw new Error("Page not initialized");
        
        // Get target accounts from database
        const targetAccountsDoc = await TargetAccounts.findOne({ username: this.username });
        const targetAccounts = targetAccountsDoc?.targetAccounts || [];
        
        if (targetAccounts.length === 0) {
            logger.warn("No target accounts found. Please set target accounts first.");
            return;
        }
        
        logger.info(`Auto-commenting will only engage with posts from: ${targetAccounts.join(', ')}`);
        console.log(`DEBUG: Loaded ${targetAccounts.length} target accounts: [${targetAccounts.join(', ')}]`);
        
        let postIndex = 1; // Start with the first post
        const maxPosts = 20; // Limit to prevent infinite scrolling
        const page = this.page;
        while (postIndex <= maxPosts) {
            // Check for exit flag
            if (typeof getShouldExitInteractions === 'function' && getShouldExitInteractions()) {
                console.log('Exit from interactions requested. Stopping loop.');
                break;
            }
            try {
                const postSelector = `article:nth-of-type(${postIndex})`;
                // Check if the post exists
                if (!(await page.$(postSelector))) {
                    console.log("No more posts found. Ending iteration...");
                    return;
                }
                const likeButtonSelector = `${postSelector} svg[aria-label="Like"]`;
                const likeButton = await page.$(likeButtonSelector);
                let ariaLabel = null;
                if (likeButton) {
                    ariaLabel = await likeButton.evaluate((el: Element) => el.getAttribute("aria-label"));
                }
                if (ariaLabel === "Like" && likeButton) {
                    console.log(`Liking post ${postIndex}...`);
                    await likeButton.click();
                    await page.keyboard.press("Enter");
                    console.log(`Post ${postIndex} liked.`);
                } else if (ariaLabel === "Unlike") {
                    console.log(`Post ${postIndex} is already liked.`);
                } else {
                    console.log(`Like button not found for post ${postIndex}.`);
                }
                // Extract and log the post caption
                const captionSelector = `${postSelector} div.x9f619 span._ap3a div span._ap3a`;
                const captionElement = await page.$(captionSelector);
                let caption = "";
                if (captionElement) {
                    caption = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                    console.log(`Caption for post ${postIndex}: ${caption}`);
                } else {
                    console.log(`No caption found for post ${postIndex}.`);
                }
                // Check if there is a '...more' link to expand the caption
                const moreLinkSelector = `${postSelector} div.x9f619 span._ap3a span div span.x1lliihq`;
                const moreLink = await page.$(moreLinkSelector);
                if (moreLink && captionElement) {
                    console.log(`Expanding caption for post ${postIndex}...`);
                    await moreLink.click();
                    const expandedCaption = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                    console.log(
                        `Expanded Caption for post ${postIndex}: ${expandedCaption}`
                    );
                    caption = expandedCaption;
                }
                // Check if post author is in target accounts
                const postAuthor = await page.evaluate((selector) => {
                    const postElement = document.querySelector(selector);
                    if (!postElement) return null;
                    
                    // Multiple strategies to find the post author
                    const strategies = [
                        // Strategy 1: Look for username in post header (most common)
                        () => {
                            const headerLinks = postElement.querySelectorAll('header a[href*="/"]');
                            for (const link of headerLinks) {
                                const href = link.getAttribute('href');
                                if (href && href.startsWith('/') && href !== '/') {
                                    const username = href.replace('/', '').split('/')[0];
                                    if (username && !['explore', 'reels', 'accounts', 'legal', 'p', 'reel', 'web', 'direct', 'stories', 'tagged'].includes(username)) {
                                        return username;
                                    }
                                }
                            }
                            return null;
                        },
                        
                        // Strategy 2: Look for username in the first few links
                        () => {
                            const allLinks = postElement.querySelectorAll('a[href*="/"]');
                            for (let i = 0; i < Math.min(5, allLinks.length); i++) {
                                const link = allLinks[i];
                                const href = link.getAttribute('href');
                                if (href && href.startsWith('/') && href !== '/') {
                                    const username = href.replace('/', '').split('/')[0];
                                    if (username && !['explore', 'reels', 'accounts', 'legal', 'p', 'reel', 'web', 'direct', 'stories', 'tagged'].includes(username)) {
                                        return username;
                                    }
                                }
                            }
                            return null;
                        },
                        
                        // Strategy 3: Look for @username in text content
                        () => {
                            const textContent = postElement.textContent || '';
                            const match = textContent.match(/@([a-zA-Z0-9._]+)/);
                            if (match && match[1]) {
                                return match[1];
                            }
                            return null;
                        }
                    ];
                    
                    // Try each strategy
                    for (const strategy of strategies) {
                        const username = strategy();
                        if (username) {
                            console.log(`Found post author using strategy: ${username}`);
                            return username;
                        }
                    }
                    
                    console.log('Could not find post author with any strategy');
                    return null;
                }, postSelector);

                if (!postAuthor) {
                    console.log(`Could not determine post author for post ${postIndex}, skipping...`);
                    postIndex++;
                    continue;
                }

                // Check if post author is in our target accounts
                console.log(`DEBUG: Post ${postIndex} author: @${postAuthor}`);
                console.log(`DEBUG: Target accounts: [${targetAccounts.join(', ')}]`);
                console.log(`DEBUG: Is @${postAuthor} in target accounts? ${targetAccounts.includes(postAuthor)}`);
                
                if (!targetAccounts.includes(postAuthor)) {
                    console.log(`❌ Post ${postIndex} is from @${postAuthor} (NOT in target accounts), skipping...`);
                    postIndex++;
                    continue;
                }

                console.log(`✅ Post ${postIndex} is from @${postAuthor} (TARGET ACCOUNT), proceeding to comment...`);

                // Comment on the post
                const commentBoxSelector = `${postSelector} textarea`;
                const commentBox = await page.$(commentBoxSelector);
                if (commentBox) {
                    console.log(`Commenting on post ${postIndex} from @${postAuthor}...`);
                    const prompt = `Write a simple, natural Instagram comment for this post from @${postAuthor}: "${caption}"

            RULES:
            - Comment like a real person, not a company
            - Be genuine and relatable
            - Keep it short (1 sentence max)
            - React to what they actually posted
            - Use casual, friendly language
            - NO corporate speak, NO "we/our team/company" language
            - NO sales pitches or follow requests
            - Just be human and authentic

            EXAMPLES:
            - Post about coffee: "This looks amazing! ☕"
            - Post about workout: "Love this energy! 💪"
            - Post about travel: "So jealous! Where is this?"
            - Post about food: "Yum! Recipe please? 👀"
            - Post about work: "This is so true!"
            - Post about motivation: "Needed this today 🙌"
            - Post about tech: "This is really cool!"
            - Post about business: "Great point!"
            - Post about life: "This hits different ✨"
            - Post about success: "Congrats! Well deserved 🎉"

            Write ONE simple, natural comment that a real person would leave.`;
                    const schema = getInstagramCommentSchema();
                    const result = await runAgent(schema, prompt);
                    const comment = (result[0]?.comment ?? "") as string;
                    await commentBox.type(comment);
                    // New selector approach for the post button
                    const postButton = await page.evaluateHandle(() => {
                        const buttons = Array.from(
                            document.querySelectorAll('div[role="button"]')
                        );
                        return buttons.find(
                            (button) =>
                                button.textContent === "Post" && !button.hasAttribute("disabled")
                        );
                    });
                    // Only click if postButton is an ElementHandle and not null
                    const postButtonElement = postButton && postButton.asElement ? postButton.asElement() : null;
                    if (postButtonElement) {
                        console.log(`Posting comment on post ${postIndex}...`);
                        await (postButtonElement as puppeteer.ElementHandle<Element>).click();
                        console.log(`Comment posted on post ${postIndex}.`);
                        
                        // Save comment to database
                        try {
                            const currentUrl = page.url();
                            const commentData = {
                                username: this.username,
                                postUrl: currentUrl,
                                postCaption: caption,
                                commentText: comment,
                                postOwner: postAuthor,
                                timestamp: new Date(),
                                isDeleted: false
                            };
                            
                            console.log(`Saving comment to database:`, {
                                username: this.username,
                                postOwner: postAuthor,
                                commentLength: comment.length,
                                captionLength: caption.length
                            });
                            
                            const savedComment = await Comment.create(commentData);
                            console.log(`✓ Comment saved to database for post ${postIndex}, ID: ${savedComment._id}`);
                        } catch (dbError) {
                            console.error(`❌ Failed to save comment to database:`, dbError);
                        }
                        
                        // Wait for comment to be posted and UI to update
                        await delay(2000);
                    } else {
                        console.log("Post button not found.");
                    }
                } else {
                    console.log("Comment box not found.");
                }
                // Wait before moving to the next post
                const waitTime = Math.floor(Math.random() * 5000) + 5000;
                console.log(
                    `Waiting ${waitTime / 1000} seconds before moving to the next post...`
                );
                await delay(waitTime);
                // Extra wait to ensure all actions are complete before scrolling
                await delay(1000);
                // Scroll to the next post
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                });
                postIndex++;
            } catch (error) {
                console.error(`Error interacting with post ${postIndex}:`, error);
                break;
            }
        }
    }

    async scrapeFollowers(targetAccount: string, maxFollowers: number) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        try {
            // Navigate to the target account's followers page
            await page.goto(`https://www.instagram.com/${targetAccount}/followers/`, {
                waitUntil: "networkidle2",
            });
            console.log(`Navigated to ${targetAccount}'s followers page`);

            // Wait for the followers modal to load (try robustly)
            try {
                await page.waitForSelector('div a[role="link"] span[title]');
            } catch {
                // fallback: wait for dialog
                await page.waitForSelector('div[role="dialog"]');
            }
            console.log("Followers modal loaded");

            const followers: string[] = [];
            let previousHeight = 0;
            let currentHeight = 0;
            let noChangeCount = 0; // Track how many times height hasn't changed
            const maxNoChangeAttempts = 3; // Try 3 times before giving up
            
            // Scroll and collect followers until we reach the desired amount or can't scroll anymore
            console.log(`Target followers to scrape: ${maxFollowers}`);
            while (followers.length < maxFollowers) {
                // Get all follower links in the current view
                const newFollowers = await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (!dialog) {
                        console.log('DEBUG: No dialog found!');
                        return [];
                    }
                    
                    // Find all links within the dialog
                    const followerElements = dialog.querySelectorAll('a[href]');
                    console.log(`DEBUG: Found ${followerElements.length} links in dialog`);
                    
                    const usernames = new Set<string>();
                    
                    followerElements.forEach((element) => {
                        const href = element.getAttribute("href");
                        if (!href) return;
                        
                        console.log(`DEBUG: Checking href: ${href}`);
                        
                        // Parse href to extract username
                        // Instagram following/followers use format: /username/ or /username
                        if (href.startsWith('/') && href !== '/') {
                            const parts = href.split('/').filter(p => p);
                            
                            // Only accept single-segment paths (just username)
                            if (parts.length === 1) {
                                const username = parts[0];
                                // Filter out known non-username paths
                                const excludedPaths = ['explore', 'reels', 'accounts', 'legal', 'p', 'reel', 'web', 'direct', 'stories'];
                                if (!excludedPaths.includes(username) && 
                                    !username.includes('?') && 
                                    !username.includes('=')) {
                                    console.log(`DEBUG: Valid username found: ${username}`);
                                    usernames.add(username);
                                }
                            }
                        }
                    });
                    
                    const result = Array.from(usernames);
                    console.log(`DEBUG: Returning ${result.length} usernames:`, result.slice(0, 5));
                    return result;
                });

                // Add new unique followers to our list
                for (const follower of newFollowers) {
                    if (!followers.includes(follower) && followers.length < maxFollowers) {
                        followers.push(follower);
                        console.log(`Found follower: ${follower}`);
                    }
                }

                // Scroll the followers modal - find the scrollable container
                const scrollInfo = await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (!dialog) return { success: false, message: 'No dialog found' };
                    
                    // Find all divs inside the dialog and check which ones are scrollable
                    const allDivs = dialog.querySelectorAll('div');
                    let scrollableDiv: HTMLElement | null = null;
                    
                    for (const div of Array.from(allDivs)) {
                        const style = window.getComputedStyle(div);
                        const overflowY = style.overflowY;
                        const scrollHeight = div.scrollHeight;
                        const clientHeight = div.clientHeight;
                        
                        // Check if this div is scrollable
                        if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > clientHeight) {
                            scrollableDiv = div as HTMLElement;
                            break;
                        }
                    }
                    
                    if (scrollableDiv) {
                        const beforeScroll = scrollableDiv.scrollTop;
                        scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
                        const afterScroll = scrollableDiv.scrollTop;
                        
                        return {
                            success: true,
                            message: 'Scrolled scrollableDiv',
                            scrollHeight: scrollableDiv.scrollHeight,
                            clientHeight: scrollableDiv.clientHeight,
                            scrollTop: afterScroll,
                            didScroll: afterScroll > beforeScroll
                        };
                    } else {
                        // Fallback: try scrolling dialog
                        dialog.scrollTop = dialog.scrollHeight;
                        return {
                            success: true,
                            message: 'Scrolled dialog (fallback)',
                            scrollHeight: dialog.scrollHeight,
                            clientHeight: dialog.clientHeight,
                            scrollTop: dialog.scrollTop,
                            didScroll: false
                        };
                    }
                });
                
                console.log(`DEBUG: Scroll info:`, JSON.stringify(scrollInfo, null, 2));

                // Wait longer for Instagram to load more content
                await delay(2000);

                // Get the current scroll height
                currentHeight = scrollInfo.scrollHeight || 0;
                
                console.log(`DEBUG: Previous height: ${previousHeight}, Current height: ${currentHeight}`);

                if (currentHeight === previousHeight) {
                    noChangeCount++;
                    console.log(`Height unchanged (${noChangeCount}/${maxNoChangeAttempts}). Waiting for more content...`);
                    
                    if (noChangeCount >= maxNoChangeAttempts) {
                        console.log("Reached the end of followers list after multiple attempts");
                        break;
                    }
                    
                    // Wait extra time for Instagram to load more data
                    await delay(3000);
                } else {
                    noChangeCount = 0; // Reset counter when height changes
                    previousHeight = currentHeight;
                }
            }

            console.log(`Successfully scraped ${followers.length} followers`);
            return followers;
        } catch (error) {
            console.error(`Error scraping followers for ${targetAccount}:`, error);
            throw error;
        }
    }

    async scrapeFollowing(maxFollowing: number) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        try {
            // Use the username from login credentials - this is the most reliable
            // The username is set during initialization/login
            const targetUsername = this.username;
            console.log(`DEBUG: Using logged-in username: ${targetUsername}`);
            
            // Navigate to the profile page first
            await page.goto(`https://www.instagram.com/${targetUsername}/`, {
                waitUntil: "networkidle2",
            });
            console.log(`Navigated to profile: ${page.url()}`);
            await delay(2000);

            // Find and click the "following" link to open the modal
            console.log('DEBUG: Looking for following button...');
            const followingClicked = await page.evaluate(() => {
                // Look for link with "following" text that contains the count
                const links = Array.from(document.querySelectorAll('a[href*="/following"]'));
                for (const link of links) {
                    const text = link.textContent?.toLowerCase();
                    if (text && text.includes('following')) {
                        console.log(`Found following link: ${link.getAttribute('href')}`);
                        (link as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            });
            
            if (!followingClicked) {
                console.log('DEBUG: Following button not found, taking screenshot...');
                await page.screenshot({ path: 'debug-profile-page.png' });
                throw new Error('Following button not found on profile');
            }
            
            console.log('DEBUG: Clicked following button, waiting for modal...');
            await delay(2000);

            // Wait for the following modal to load
            try {
                await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
                console.log("Following modal loaded");
            } catch {
                console.log('DEBUG: Modal did not appear, taking screenshot...');
                await page.screenshot({ path: 'debug-no-modal.png' });
                throw new Error('Following modal did not appear after clicking');
            }

            // Take a screenshot first
            await page.screenshot({ path: 'debug-following-modal.png', fullPage: false });
            console.log('DEBUG: Screenshot saved to debug-following-modal.png');

            // Debug: Inspect the dialog HTML structure
            const dialogInfo = await page.evaluate(() => {
                // Try multiple possible selectors
                const dialog1 = document.querySelector('div[role="dialog"]');
                const dialog2 = document.querySelector('[role="dialog"]');
                const dialog3 = document.querySelector('div._aano'); // Instagram sometimes uses this class
                
                const dialog = dialog1 || dialog2 || dialog3;
                
                if (!dialog) {
                    // If no dialog found, let's see what's on the page
                    const allLinks = document.querySelectorAll('a[href]');
                    const sampleAllLinks = Array.from(allLinks).slice(0, 20).map(a => ({
                        href: a.getAttribute('href'),
                        text: a.textContent?.substring(0, 30),
                        classes: a.className
                    }));
                    
                    return { 
                        found: false,
                        totalLinksOnPage: allLinks.length,
                        sampleAllLinks,
                        bodyHTML: document.body.innerHTML.substring(0, 1000)
                    };
                }
                
                const allLinks = dialog.querySelectorAll('a[href]');
                const sampleLinks = Array.from(allLinks).slice(0, 10).map(a => ({
                    href: a.getAttribute('href'),
                    text: a.textContent?.substring(0, 50),
                    hasTitle: !!a.querySelector('span[title]'),
                    title: a.querySelector('span[title]')?.getAttribute('title')
                }));
                
                return {
                    found: true,
                    selectorUsed: dialog1 ? 'div[role="dialog"]' : dialog2 ? '[role="dialog"]' : 'div._aano',
                    totalLinks: allLinks.length,
                    sampleLinks,
                    dialogHTML: dialog.innerHTML.substring(0, 500)
                };
            });
            
            console.log('DEBUG: Dialog structure:', JSON.stringify(dialogInfo, null, 2));

            const following: string[] = [];
            let previousHeight = 0;
            let currentHeight = 0;
            let noChangeCount = 0; // Track how many times height hasn't changed
            const maxNoChangeAttempts = 3; // Try 3 times before giving up
            
            // Scroll and collect following until we reach the desired amount or can't scroll anymore
            console.log(`Target following to scrape: ${maxFollowing}`);
            while (following.length < maxFollowing) {
                // Get all following links in the current view
                const newFollowing = await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (!dialog) {
                        console.log('DEBUG: No dialog found!');
                        return [];
                    }
                    
                    // Find all links within the dialog
                    const followingElements = dialog.querySelectorAll('a[href]');
                    console.log(`DEBUG: Found ${followingElements.length} links in dialog`);
                    
                    const usernames = new Set<string>();
                    
                    followingElements.forEach((element) => {
                        const href = element.getAttribute("href");
                        if (!href) return;
                        
                        console.log(`DEBUG: Checking href: ${href}`);
                        
                        // Parse href to extract username
                        // Instagram following/followers use format: /username/ or /username
                        if (href.startsWith('/') && href !== '/') {
                            const parts = href.split('/').filter(p => p);
                            
                            // Only accept single-segment paths (just username)
                            if (parts.length === 1) {
                                const username = parts[0];
                                // Filter out known non-username paths
                                const excludedPaths = ['explore', 'reels', 'accounts', 'legal', 'p', 'reel', 'web', 'direct', 'stories'];
                                if (!excludedPaths.includes(username) && 
                                    !username.includes('?') && 
                                    !username.includes('=')) {
                                    console.log(`DEBUG: Valid username found: ${username}`);
                                    usernames.add(username);
                                }
                            }
                        }
                    });
                    
                    const result = Array.from(usernames);
                    console.log(`DEBUG: Returning ${result.length} usernames:`, result.slice(0, 5));
                    return result;
                });

                // Add new unique following to our list
                for (const followedUser of newFollowing) {
                    if (!following.includes(followedUser) && following.length < maxFollowing) {
                        following.push(followedUser);
                        console.log(`Found following: ${followedUser}`);
                    }
                }

                // Scroll the following modal - find the scrollable container
                const scrollInfo = await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (!dialog) return { success: false, message: 'No dialog found' };
                    
                    // Find all divs inside the dialog and check which ones are scrollable
                    const allDivs = dialog.querySelectorAll('div');
                    let scrollableDiv: HTMLElement | null = null;
                    
                    for (const div of Array.from(allDivs)) {
                        const style = window.getComputedStyle(div);
                        const overflowY = style.overflowY;
                        const scrollHeight = div.scrollHeight;
                        const clientHeight = div.clientHeight;
                        
                        // Check if this div is scrollable
                        if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > clientHeight) {
                            scrollableDiv = div as HTMLElement;
                            break;
                        }
                    }
                    
                    if (scrollableDiv) {
                        const beforeScroll = scrollableDiv.scrollTop;
                        scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
                        const afterScroll = scrollableDiv.scrollTop;
                        
                        return {
                            success: true,
                            message: 'Scrolled scrollableDiv',
                            scrollHeight: scrollableDiv.scrollHeight,
                            clientHeight: scrollableDiv.clientHeight,
                            scrollTop: afterScroll,
                            didScroll: afterScroll > beforeScroll
                        };
                    } else {
                        // Fallback: try scrolling dialog
                        dialog.scrollTop = dialog.scrollHeight;
                        return {
                            success: true,
                            message: 'Scrolled dialog (fallback)',
                            scrollHeight: dialog.scrollHeight,
                            clientHeight: dialog.clientHeight,
                            scrollTop: dialog.scrollTop,
                            didScroll: false
                        };
                    }
                });
                
                console.log(`DEBUG: Scroll info:`, JSON.stringify(scrollInfo, null, 2));

                // Wait longer for Instagram to load more content
                await delay(2000);

                // Get the current scroll height
                currentHeight = scrollInfo.scrollHeight || 0;
                
                console.log(`DEBUG: Previous height: ${previousHeight}, Current height: ${currentHeight}`);

                if (currentHeight === previousHeight) {
                    noChangeCount++;
                    console.log(`Height unchanged (${noChangeCount}/${maxNoChangeAttempts}). Waiting for more content...`);
                    
                    if (noChangeCount >= maxNoChangeAttempts) {
                        console.log("Reached the end of following list after multiple attempts");
                        break;
                    }
                    
                    // Wait extra time for Instagram to load more data
                    await delay(3000);
                } else {
                    noChangeCount = 0; // Reset counter when height changes
                    previousHeight = currentHeight;
                }
            }

            console.log(`Successfully scraped ${following.length} following`);
            return following;
        } catch (error) {
            console.error(`Error scraping following list:`, error);
            throw error;
        }
    }

    async deleteComment(postUrl: string, commentText: string) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        try {
            console.log(`Navigating to post: ${postUrl}`);
            await page.goto(postUrl, { waitUntil: "networkidle2" });
            await delay(2000);

            // Find the comment with the matching text
            const commentFound = await page.evaluate((searchText: string) => {
                const commentElements = document.querySelectorAll('span');
                for (const element of Array.from(commentElements)) {
                    if (element.textContent?.trim() === searchText) {
                        // Find the parent comment container
                        let parent = element.parentElement;
                        while (parent && !parent.querySelector('button[aria-label*="More"]')) {
                            parent = parent.parentElement;
                        }
                        if (parent) {
                            const moreButton = parent.querySelector('button[aria-label*="More"]') as HTMLElement;
                            if (moreButton) {
                                moreButton.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, commentText);

            if (!commentFound) {
                throw new Error(`Comment not found: ${commentText}`);
            }

            // Wait for the menu to appear and click delete
            await delay(1000);
            const deleteButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(button => 
                    button.textContent?.toLowerCase().includes('delete') ||
                    button.textContent?.toLowerCase().includes('unfollow')
                );
            });

            if (deleteButton && deleteButton.asElement) {
                const deleteButtonElement = deleteButton.asElement();
                if (deleteButtonElement) {
                    await (deleteButtonElement as puppeteer.ElementHandle<Element>).click();
                    await delay(1000);

                    // Confirm deletion if prompted
                    const confirmButton = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        return buttons.find(button => 
                            button.textContent?.toLowerCase().includes('delete')
                        );
                    });

                    if (confirmButton && confirmButton.asElement) {
                        const confirmButtonElement = confirmButton.asElement();
                        if (confirmButtonElement) {
                            await (confirmButtonElement as puppeteer.ElementHandle<Element>).click();
                            await delay(1000);
                        }
                    }
                }
            }

            console.log(`Successfully deleted comment: ${commentText}`);
        } catch (error) {
            console.error(`Error deleting comment:`, error);
            throw error;
        }
    }

    async followUser(username: string): Promise<boolean> {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        
        try {
            logger.info(`Attempting to follow @${username}`);
            
            // Navigate to user's profile
            await page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: "networkidle2",
            });
            await delay(2000);

            // Find and click the Follow button
            const followButtonClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const button of buttons) {
                    const text = button.textContent?.trim();
                    if (text === 'Follow' || text === 'Follow Back') {
                        button.click();
                        return true;
                    }
                }
                return false;
            });

            if (followButtonClicked) {
                await delay(2000);
                logger.info(`✓ Successfully followed @${username}`);
                return true;
            } else {
                logger.warn(`Follow button not found for @${username} (might already be following)`);
                return false;
            }
        } catch (error) {
            logger.error(`Failed to follow @${username}:`, error);
            throw error;
        }
    }

    async unfollowUser(username: string): Promise<boolean> {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        
        try {
            logger.info(`Attempting to unfollow @${username}`);
            
            // Navigate to user's profile
            await page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: "networkidle2",
            });
            await delay(2000);

            // Find and click the Following button
            const followingButtonClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const button of buttons) {
                    const text = button.textContent?.trim();
                    if (text === 'Following' || text === 'Requested') {
                        button.click();
                        return true;
                    }
                }
                return false;
            });

            if (!followingButtonClicked) {
                logger.warn(`Following button not found for @${username} (might not be following)`);
                return false;
            }

            await delay(1500);

            // Click Unfollow in the confirmation dialog
            const unfollowConfirmed = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const button of buttons) {
                    const text = button.textContent?.trim();
                    if (text === 'Unfollow') {
                        button.click();
                        return true;
                    }
                }
                return false;
            });

            if (unfollowConfirmed) {
                await delay(2000);
                logger.info(`✓ Successfully unfollowed @${username}`);
                return true;
            } else {
                logger.warn(`Unfollow confirmation not found for @${username}`);
                return false;
            }
        } catch (error) {
            logger.error(`Failed to unfollow @${username}:`, error);
            throw error;
        }
    }

    async checkIfUserFollowsBack(username: string): Promise<boolean> {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        
        try {
            // Navigate to user's profile
            await page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: "networkidle2",
            });
            await delay(1500);

            // Check if "Follows you" badge is present
            const followsBack = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('span, div'));
                for (const element of elements) {
                    const text = element.textContent?.trim();
                    if (text === 'Follows you' || text === 'Follows You') {
                        return true;
                    }
                }
                return false;
            });

            return followsBack;
        } catch (error) {
            logger.error(`Failed to check follow-back status for @${username}:`, error);
            return false;
        }
    }

    public async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

export async function scrapeFollowersHandler(targetAccount: string, maxFollowers: number) {
    const client = new IgClient(IGusername, IGpassword);
    await client.init();
    const followers = await client.scrapeFollowers(targetAccount, maxFollowers);
    await client.close();
    return followers;
}