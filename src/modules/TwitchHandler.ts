import axios from 'axios';
import Bot from '../Bot';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as cron from 'node-cron';
import { EmbedBuilder, TextChannel, ContainerBuilder, SeparatorSpacingSize, TextDisplayBuilder, MessageFlags, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder } from 'discord.js';
import 'dotenv/config';
import { getRoles, getChannels } from '../GuildSpecifics';

const streamersFilePath = path.join(process.cwd(), 'monitored-streamers.json');
const dashboardDataFilePath = path.join(process.cwd(), 'dashboard-data.json');
const notificationsFilePath = path.join(process.cwd(), 'notifications.json');
const contentCreatorRoleId = getRoles(process.env.GUILD_ID).CONTENT_CREATOR_ROLE;
const liveRoleId = getRoles(process.env.GUILD_ID).LIVE_ROLE;
const contentCreatorChannelId = getChannels(process.env.GUILD_ID).TWITCH_NOTIFICATION_CHANNEL;

interface MonitoredStreamer {
    id: string;
    userName: string;
    displayName: string;
    discordUserId: string | null;
    profileImageUrl: string;
    isLive: boolean;
    lastLiveAt: Date | null;
}

export default class TwitchHandler {
    private client: Bot;
    private clientId: string;
    private clientSecret: string;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private liveStreamers: Set<string> = new Set();
    private contentCreatorsDashboardMessageId: string | null = null;
    private liveNotificationMessages: Map<string, string> = new Map(); // streamer userName -> message ID
    private isFirstCheck: boolean = true;

    constructor(client: Bot) {
        this.client = client;
        this.clientId = process.env.TWITCH_CLIENT_ID!;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET!;
        this.loadDashboardData();
        this.loadNotifications();
    }

    public startMonitoring() {
        cron.schedule('*/2 * * * *', () => this.checkLiveStreams());
        this.client.logger.log({ message: 'Twitch stream monitoring has started. Checking every 2 minutes.', handler: this.constructor.name }, true);
    }

    private async checkLiveStreams() {
        this.client.logger.log({ message: 'Checking for live Twitch streams...', handler: this.constructor.name }, true);
        const streamers = await this.readStreamers();
        if (streamers.length === 0) {
            this.client.logger.log({ message: 'No streamers to monitor.', handler: this.constructor.name }, true);
            this.isFirstCheck = false;
            return;
        }

        // Get current state from sources of truth
        const userLogins = streamers.map(s => s.userName);
        const liveStreamsFromAPI = await this.getLiveStreams(userLogins);
        const liveUserNamesFromAPI = new Set(liveStreamsFromAPI.map(s => s.user_login.toLowerCase()));
        const trackedNotifications = new Map(this.liveNotificationMessages); // Create a copy to iterate over

        let hasStatusChanges = false;

        // Process streamers who went OFFLINE
        for (const [userName, messageId] of trackedNotifications.entries()) {
            if (!liveUserNamesFromAPI.has(userName)) {
                // This streamer has a notification but is not live according to the API
                this.client.logger.log({ message: `${userName} just went offline (or was found offline during check).`, handler: this.constructor.name }, true);
                await this.deleteLiveNotification(userName); // This will remove from liveNotificationMessages and save

                const streamerInfo = streamers.find(s => s.userName.toLowerCase() === userName);
                if (streamerInfo) {
                    if (streamerInfo.isLive) hasStatusChanges = true; // Only a "change" if we thought they were live
                    streamerInfo.isLive = false;
                    if (streamerInfo.discordUserId) {
                        await this.updateUserRole(streamerInfo.discordUserId, false);
                }
                }
            }
        }

        // Process streamers who went ONLINE
        for (const liveStream of liveStreamsFromAPI) {
            const userNameLower = liveStream.user_login.toLowerCase();
            // Use the main `this.liveNotificationMessages` for the check, as `trackedNotifications` is a stale copy
            if (!this.liveNotificationMessages.has(userNameLower)) {
                // This streamer is live but we don't have a notification for them
                const streamerInfo = streamers.find(s => s.userName.toLowerCase() === userNameLower);
                if (streamerInfo) {
                    this.client.logger.log({ message: `${streamerInfo.displayName} just went live!`, handler: this.constructor.name }, true);
                    if (!streamerInfo.isLive) hasStatusChanges = true; // Only a "change" if we thought they were offline
                    streamerInfo.isLive = true;
                    streamerInfo.lastLiveAt = new Date();
                    await this.sendLiveNotification(liveStream, streamerInfo); // This will add to liveNotificationMessages and save
                    if (streamerInfo.discordUserId) {
                        await this.updateUserRole(streamerInfo.discordUserId, true);
                }
                }
            }
        }

        // Update dashboard if there were status changes or on the first run after a restart
        if (hasStatusChanges || this.isFirstCheck) {
            await this.updateContentCreatorsDashboard();
        }

        this.isFirstCheck = false;
        await this.writeStreamers(streamers);
    }

    private async sendLiveNotification(streamData: any, streamerInfo: MonitoredStreamer) {
        console.log(`--- DEBUG: Attempting to send notification for ${streamerInfo.displayName} ---`);
        if (!contentCreatorChannelId) {
            this.client.logger.error({ message: 'TWITCH_NOTIFICATION_CHANNEL is not set in the environment variables.', error: new Error('TWITCH_NOTIFICATION_CHANNEL not set'), handler: this.constructor.name });
            return;
        }

        try {
            const channel = this.client.channels.cache.get(contentCreatorChannelId);
            if (!channel) {
                console.error(`--- DEBUG: Could not find channel with ID: ${contentCreatorChannelId} ---`);
                this.client.logger.error({
                    message: 'Twitch notifications channel not found.',
                    error: new Error(`Channel ID: ${contentCreatorChannelId}`),
                    handler: 'TwitchHandler'
                });
                return;
            }

            console.log(`--- DEBUG: Found channel, creating embed for ${streamData.user_name} ---`);

            console.log(`--- DEBUG: Streamer info:`, {
                displayName: streamerInfo.displayName,
                profileImageUrl: streamerInfo.profileImageUrl,
                streamTitle: streamData.title,
                gameName: streamData.game_name,
                viewerCount: streamData.viewer_count
            });

            const embed = new EmbedBuilder()
                .setColor(0x9146FF);

            console.log(`--- DEBUG: Basic embed created, adding author ---`);

            // Safely add author
            try {
                embed.setAuthor({
                    name: `${streamData.user_name} is now live on Twitch!`,
                    iconURL: streamerInfo.profileImageUrl || undefined,
                    url: `https://twitch.tv/${streamData.user_name}`
                });
                console.log(`--- DEBUG: Author added successfully ---`);
            } catch (authorError: any) {
                console.error(`--- DEBUG: Failed to set author:`, authorError);
                embed.setAuthor({
                    name: `${streamData.user_name} is now live on Twitch!`,
                    url: `https://twitch.tv/${streamData.user_name}`
                });
            }

            console.log(`--- DEBUG: Adding title and URL ---`);
            embed.setTitle(streamData.title || 'Untitled Stream')
                .setURL(`https://twitch.tv/${streamData.user_name}`);

            console.log(`--- DEBUG: Adding fields ---`);
            embed.addFields(
                { name: 'Game', value: streamData.game_name || 'Unknown', inline: true },
                { name: 'Viewers', value: streamData.viewer_count.toString(), inline: true }
            );

            console.log(`--- DEBUG: Adding thumbnail ---`);
            embed.setThumbnail('https://cdn.discordapp.com/emojis/1390406748262895806.webp?size=96');

            console.log(`--- DEBUG: Adding timestamp ---`);
            embed.setTimestamp();

            console.log(`--- DEBUG: Embed created successfully, now processing thumbnail ---`);

            const thumbnailUrl = streamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720');
            console.log(`--- DEBUG: Thumbnail URL: ${thumbnailUrl} ---`);

            console.log(`--- DEBUG: Calling reuploadImage function ---`);
            const reuploadedUrl = await this.client.util.reuploadImage(thumbnailUrl);
            console.log(`--- DEBUG: reuploadImage returned: ${reuploadedUrl} ---`);

            if (reuploadedUrl) {
                console.log(`--- DEBUG: Setting image on embed ---`);
                embed.setImage(reuploadedUrl);
            }

            console.log(`--- DEBUG: About to send embed to channel ---`);
            try {
                const sentMessage = await (channel as TextChannel).send({
                    content: `<@&1390408053114933381> https://twitch.tv/${streamData.user_name}`,
                    embeds: [embed]
                });
                console.log(`--- DEBUG: Successfully sent message with ID: ${sentMessage.id} ---`);

                // Store the message ID for this streamer so we can delete it later
                this.liveNotificationMessages.set(streamData.user_name.toLowerCase(), sentMessage.id);
                await this.saveNotifications();
                console.log(`--- DEBUG: Stored notification message ID for ${streamData.user_name} ---`);
            } catch (sendError: any) {
                console.error(`--- DEBUG: Failed to send embed: ${sendError.message} ---`);
                console.error(`--- DEBUG: Full error:`, sendError);
                throw sendError;
            }

            console.log(`--- DEBUG: Notification sent successfully for ${streamData.user_name} ---`);
        } catch (error) {
            console.log(`--- DEBUG: FAILED to send notification for ${streamerInfo.displayName} ---`);
            this.client.logger.error({ message: 'Failed to send Twitch live notification.', error, handler: this.constructor.name });
        }
    }

    private async deleteLiveNotification(userName: string): Promise<void> {
        try {
            const messageId = this.liveNotificationMessages.get(userName.toLowerCase());
            if (!messageId) {
                console.log(`--- DEBUG: No stored message ID for ${userName} ---`);
                return;
            }

            const channel = this.client.channels.cache.get(contentCreatorChannelId) as TextChannel;
            if (!channel) {
                console.error(`--- DEBUG: Could not find notification channel ---`);
                return;
            }

            console.log(`--- DEBUG: Attempting to delete message ${messageId} for ${userName} ---`);
            const message = await channel.messages.fetch(messageId);
            if (message) {
                await message.delete();
                console.log(`--- DEBUG: Successfully deleted live notification for ${userName} ---`);
            }

            // Remove from our tracking map
            this.liveNotificationMessages.delete(userName.toLowerCase());
            await this.saveNotifications();
        } catch (error: any) {
            console.error(`--- DEBUG: Failed to delete live notification for ${userName}:`, error.message);
            // Remove from tracking map even if deletion failed (message might already be deleted)
            this.liveNotificationMessages.delete(userName.toLowerCase());
            await this.saveNotifications();
        }
    }

    private async updateUserRole(userId: string, isLive: boolean) {
        try {
            const guild = await this.client.guilds.fetch(process.env.GUILD_ID!); // Assumes GUILD_ID is set in .env
            const member = await guild.members.fetch(userId);

            if (isLive) {
                await member.roles.add(liveRoleId);
                this.client.logger.log({ message: `Added 'Live on Twitch' role to ${member.user.tag}`, handler: this.constructor.name }, true);
            } else {
                await member.roles.remove(liveRoleId);
                this.client.logger.log({ message: `Removed 'Live on Twitch' role from ${member.user.tag}`, handler: this.constructor.name }, true);
            }
        } catch (error) {
            console.error(error);
            this.client.logger.error({ message: `Failed to update role for user ${userId}.`, error, handler: this.constructor.name });
        }
    }

    private async loadNotifications(): Promise<void> {
        try {
            const data = await fs.readFile(notificationsFilePath, 'utf-8');
            const notifications = JSON.parse(data);
            this.liveNotificationMessages = new Map(Object.entries(notifications));
            this.client.logger.log({ message: `Loaded ${this.liveNotificationMessages.size} notification message IDs.`, handler: this.constructor.name }, true);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                this.client.logger.log({ message: 'notifications.json not found, starting fresh.', handler: this.constructor.name }, true);
                this.liveNotificationMessages = new Map();
            } else {
                this.client.logger.error({ message: 'Failed to load notifications.json.', error, handler: this.constructor.name });
            }
        }
    }

    private async saveNotifications(): Promise<void> {
        try {
            const notificationsObject = Object.fromEntries(this.liveNotificationMessages);
            await fs.writeFile(notificationsFilePath, JSON.stringify(notificationsObject, null, 4));
        } catch (error) {
            this.client.logger.error({ message: 'Failed to save notifications.json.', error, handler: this.constructor.name });
        }
    }

    private async getLiveStreams(userLogins: string[]): Promise<any[]> {
        const token = await this.getAccessToken();
        if (!token) return [];

        let allLiveStreams: any[] = [];
        const batchSize = 100;

        for (let i = 0; i < userLogins.length; i += batchSize) {
            const batch = userLogins.slice(i, i + batchSize);
            const params = new URLSearchParams();
            batch.forEach(login => params.append('user_login', login));

            try {
                const response = await axios.get(`https://api.twitch.tv/helix/streams`, {
                    headers: {
                        'Client-ID': this.clientId,
                        'Authorization': `Bearer ${token}`
                    },
                    params
                });

                if (response.data && response.data.data) {
                    allLiveStreams = allLiveStreams.concat(response.data.data);
                }
            } catch (error) {
                this.client.logger.error({ message: `Error getting live streams for batch.`, error, handler: this.constructor.name });
            }
        }
        return allLiveStreams;
    }

    private async readStreamers(): Promise<MonitoredStreamer[]> {
        try {
            await fs.access(streamersFilePath);
            const data = await fs.readFile(streamersFilePath, 'utf-8');
            return JSON.parse(data) as MonitoredStreamer[];
        } catch (error) {
            return [];
        }
    }

    private async writeStreamers(data: MonitoredStreamer[]): Promise<void> {
        await fs.writeFile(streamersFilePath, JSON.stringify(data, null, 2));
    }

    private loadDashboardData(): void {
        try {
            const data = require('fs').readFileSync(dashboardDataFilePath, 'utf-8');
            const dashboardData = JSON.parse(data);
            this.contentCreatorsDashboardMessageId = dashboardData.messageId || null;
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
            this.contentCreatorsDashboardMessageId = null;
        }
    }

    private async saveDashboardData(): Promise<void> {
        const dashboardData = {
            messageId: this.contentCreatorsDashboardMessageId
        };
        await fs.writeFile(dashboardDataFilePath, JSON.stringify(dashboardData, null, 2));
    }

    private async getAccessToken(): Promise<string | null> {
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                params: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'client_credentials'
                }
            });

            if (response.data && response.data.access_token) {
                this.accessToken = response.data.access_token;
                const expiresIn = response.data.expires_in;
                this.tokenExpiry = new Date(new Date().getTime() + (expiresIn - 60) * 1000); // Subtract 60s for buffer
                this.client.logger.log({ message: 'Successfully obtained new Twitch API access token.', handler: this.constructor.name }, true);
                return this.accessToken;
            }
            return null;
        } catch (error) {
            this.client.logger.error({ message: 'Failed to obtain Twitch API access token.', error, handler: this.constructor.name });
            return null;
        }
    }

    public async isStreamLive(userName: string): Promise<any> {
        const token = await this.getAccessToken();
        if (!token) {
            return { isLive: false, error: 'Could not get access token.' };
        }

        try {
            const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${userName}`, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data && response.data.data.length > 0) {
                return { isLive: true, streamData: response.data.data[0] };
            } else {
                return { isLive: false };
            }
        } catch (error) {
            this.client.logger.error({ message: `Error checking live status for ${userName}.`, error, handler: this.constructor.name });
            return { isLive: false, error: 'API request failed.' };
        }
    }

    public async getStreamerInfo(userName: string): Promise<any> {
        const token = await this.getAccessToken();
        if (!token) return null;

        try {
            const response = await axios.get(`https://api.twitch.tv/helix/users?login=${userName}`, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data && response.data.data.length > 0) {
                return response.data.data[0];
            }
            return null;
        } catch (error) {
            this.client.logger.error({ message: `Error getting info for ${userName}.`, error, handler: this.constructor.name });
            return null;
        }
    }

    public async updateContentCreatorsDashboard(): Promise<void> {
        try {
            const guild = await this.client.guilds.fetch(`${process.env.GUILD_ID}`);
            if (!guild) {
                console.error(`--- DEBUG: Could not find guild with ID ${process.env.GUILD_ID} ---`);
                return;
            }

            console.log(`--- DEBUG: Using guild: ${guild.name} (${guild.id}) ---`);

            // Fetch all guild members to ensure we have the complete list
            console.log('--- DEBUG: Fetching all guild members ---');
            await guild.members.fetch();
            console.log(`--- DEBUG: Guild has ${guild.members.cache.size} cached members ---`);

            // Get all members with the content creator role
            const contentCreators = guild.members.cache.filter(member =>
                member.roles.cache.has(contentCreatorRoleId)
            );

            console.log(`--- DEBUG: Found ${contentCreators.size} content creators ---`);
            console.log('--- DEBUG: Content creators:', contentCreators.map(m => m.displayName));

            // Load monitored streamers to get Twitch usernames
            const monitoredStreamers = await this.readStreamers();

            // Create a function to format member names with Twitch links if available
            const formatMemberName = (member: any, prefix: string = '') => {
                // Try to find this member in monitored streamers by Discord user ID
                const streamerData = monitoredStreamers.find(s => s.discordUserId === member.id);
                if (streamerData) {
                    return `${prefix}[${member.displayName}](https://twitch.tv/${streamerData.userName})`;
                }
                // If no Twitch data found, return plain name
                return `${prefix}${member.displayName}`;
            };

            // Separate live streamers from offline content creators
            const liveStreamers = contentCreators.filter(member =>
                member.roles.cache.has(liveRoleId)
            );

            const offlineCreators = contentCreators.filter(member =>
                !member.roles.cache.has(liveRoleId)
            );

            console.log(`--- DEBUG: ${liveStreamers.size} live streamers, ${offlineCreators.size} offline creators ---`);

            // Create the base dashboard container
            const container = new ContainerBuilder().setAccentColor(0x9146FF);

            // Title section
            const titleData: string[] = ['# Partnered Content Creators', `${contentCreators.size === 0 ? 'No Content creators found.' : '## Currently Live'}`];
            liveStreamers.map(member => titleData.push(formatMemberName(member, '🔴 ')));
            const titleText = new TextDisplayBuilder().setContent(titleData.join('\n'));

            const titleThumbnail = new ThumbnailBuilder()
                .setDescription('Partnered Content Creators')
                .setURL('https://cdn.discordapp.com/emojis/1390430953322713159.webp?size=96');

            const titleSection = new SectionBuilder()
                .addTextDisplayComponents(titleText)
                .setThumbnailAccessory(titleThumbnail);

            container.addSectionComponents(titleSection);
            // Title section

            // Offline Creators
            if (contentCreators.size > 0 && offlineCreators.size > 0) {
                container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                const offlineCreatorsData: string[] = ['## Not Currently Live'];
                offlineCreators.map(member => offlineCreatorsData.push(formatMemberName(member, '⚫ ')));
                const offlineCreatorsText = new TextDisplayBuilder().setContent(offlineCreatorsData.join('\n'));

                container.addTextDisplayComponents(offlineCreatorsText);
            }

            // Add the thumbnail
            const footerThumbnail = new MediaGalleryBuilder().addItems({
                description: "Amascut",
                media: { url: "https://cdn.discordapp.com/attachments/1389379617915408448/1390437431001743510/cc02b5d89002a6efd4d2dc2916b29094.jpg?ex=68684144&is=6866efc4&hm=c4a354da43ede22b2f4694ac730a221cc5f5e1656351f776db3d1c1426b6a9be&" }
            });

            container.addMediaGalleryComponents(footerThumbnail);

            const channel = this.client.channels.cache.get(contentCreatorChannelId) as TextChannel;
            if (!channel) return;

            // Update or create the dashboard message
            if (this.contentCreatorsDashboardMessageId) {
                try {
                    const existingMessage = await channel.messages.fetch(this.contentCreatorsDashboardMessageId);
                    await existingMessage.edit({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: {"parse": [] }});
                    console.log('--- DEBUG: Updated existing dashboard message ---');
                } catch (error) {
                    // Message was deleted, create a new one
                    const newMessage = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: {"parse": [] }});
                    this.contentCreatorsDashboardMessageId = newMessage.id;
                    await this.saveDashboardData();
                    console.log('--- DEBUG: Created new dashboard message ---');
                }
            } else {
                const newMessage = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: {"parse": [] }});
                this.contentCreatorsDashboardMessageId = newMessage.id;
                await this.saveDashboardData();
                console.log('--- DEBUG: Created initial dashboard message ---');
            }

        } catch (error) {
            console.error('--- DEBUG: Error in updateContentCreatorsDashboard ---', error);
            this.client.logger.error({
                message: 'Failed to update content creators dashboard',
                error: error,
                handler: 'TwitchHandler'
            });
        }
    }
}
