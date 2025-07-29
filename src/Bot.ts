import 'dotenv/config';
import { Client, ClientOptions, MessageReaction, PartialMessageReaction, User, PartialUser, Role, GuildMember, TextChannel, EmbedBuilder, GuildEmoji, DiscordAPIError } from 'discord.js';
import { TempChannelsManagerEvents } from '@hunteroi/discord-temp-channels';
import BotLogger from './modules/LoggingHandler';
import InteractionHandler from './modules/InteractionHandler';
import EventHandler from './modules/EventHandler';
import UtilityHandler from './modules/UtilityHandler';
import TwitchHandler from './modules/TwitchHandler';
import TempChannelManager from './modules/TempVCHandler';
import AutoTriggerHandler from './modules/AutoTriggerHandler';
import URLReactionHandler from './modules/URLReactionHandler';
import ForumTodoHandler from './modules/ForumTodoHandler';
import { DataSource } from "typeorm"
import { AppDataSource } from './DataSource';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getChannels } from './GuildSpecifics';

// Interfaces and helpers for Reaction Roles
const reactionRolesFilePath = path.join(process.cwd(), 'reaction-roles.json');
const activeMessagesFilePath = path.join(process.cwd(), 'active-reaction-messages.json');
const LOG_CHANNEL_ID = getChannels(process.env.GUILD_ID).LOG_CHANNEL_ID;

interface ReactionRole {
    emoji: string;
    roleId: string;
    hierarchy: number;
    requiredRoleId: string | null;
}

interface ReactionRolesData {
    [category: string]: ReactionRole[];
}

interface ActiveMessages {
    [messageId: string]: string | string[] | { channelId: string; categories: string | string[] };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
    try {
        await fs.access(filePath);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        return {} as T;
    }
}

export default interface Bot extends Client {
    color: number;
    dataSource: DataSource;
    commandsRun: number;
    util: UtilityHandler;
    quitting?: boolean;
    location?: string;
    logger: BotLogger;
    interactions: InteractionHandler;
    events: EventHandler;
    twitchHandler: TwitchHandler;
    autoTrigger: AutoTriggerHandler;
    urlReactionHandler: URLReactionHandler;
    forumTodoHandler: ForumTodoHandler;
    tempManager?: TempChannelManager;
    emojiCache: Map<string, GuildEmoji>;
    tempSubmissionData?: Map<string, any>;
}

export default class Bot extends Client {
    constructor(options: ClientOptions) {
        super(options);

        this.color = 0x7e686c; // solak color scheme
        this.dataSource = AppDataSource;
        this.commandsRun = 0;
        this.util = new UtilityHandler(this);
        this.quitting = false;
        this.location = process.cwd();
        this.logger = new BotLogger();
        this.twitchHandler = new TwitchHandler(this);
        this.autoTrigger = new AutoTriggerHandler(this);
        this.urlReactionHandler = new URLReactionHandler(this);
        this.forumTodoHandler = new ForumTodoHandler(this);
        this.interactions = new InteractionHandler(this).build();
        this.events = new EventHandler(this);
        this.emojiCache = new Map<string, GuildEmoji>();
        this.tempSubmissionData = new Map<string, any>(); // temp storage for multi-step processes

        // TODO: might want to move this reaction role stuff to its own handler
        // Direct Reaction Role Listeners
        this.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    this.logger.error({ message: '[ReactionAdd] Failed to fetch partial reaction:', error });
                    return;
                }
            }

            // Handle forum todo completion
            if (await this.forumTodoHandler.handleForumTodoReaction(reaction, user)) {
                return;
            }

            const activeMessages = await readJsonFile<ActiveMessages>(activeMessagesFilePath);
            let messageData = activeMessages[reaction.message.id];

            if (!messageData) return;

            // Handle both old format (direct categories) and new format (object with categories property)
            // this is kinda messy but needed for backwards compatibility
            let categories: string[];
            if (typeof messageData === 'string') {
                categories = [messageData];
            } else if (Array.isArray(messageData)) {
                categories = messageData;
            } else if (typeof messageData === 'object' && 'categories' in messageData && messageData.categories) {
                categories = Array.isArray(messageData.categories) ? messageData.categories : [messageData.categories];
            } else {
                this.logger.log({ message: `[ReactionAdd] Invalid message data format for message ${reaction.message.id}` }, true);
                return;
            }

            const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);
            const emojiIdentifier = reaction.emoji.name;

            let foundRole: ReactionRole | undefined;
            let foundCategory: string | undefined;
            let foundCategoryRoles: ReactionRole[] | undefined;

            // find the role in any of the categories
            for (const category of categories) {
                const categoryRoles = reactionRolesData[category];
                if (!categoryRoles) continue;

            const reactionRole = categoryRoles.find(r => r.emoji === emojiIdentifier);
                if (reactionRole) {
                    foundRole = reactionRole;
                    foundCategory = category;
                    foundCategoryRoles = categoryRoles;
                    break;
                }
            }

            if (!foundRole || !foundCategory || !foundCategoryRoles) {
                 this.logger.log({ message: `[ReactionAdd] No role found for emoji '${emojiIdentifier}' in any associated category for message ${reaction.message.id}. Aborting.` }, true);
                return;
            }

            this.logger.log({ message: `[ReactionAdd] Matched emoji '${emojiIdentifier}' to roleId ${foundRole.roleId} in category '${foundCategory}'` }, true);

            const guild = reaction.message.guild;
            if (!guild) return;
            const member = await guild.members.fetch(user.id);

            // check if user is eligible for the role
            let isEligible = false;
            if (!foundRole.requiredRoleId) {
                this.logger.log({ message: `[ReactionAdd] Role has no requiredRoleId. Eligible. Hierarchy: ${foundRole.hierarchy}` }, true);
                isEligible = true;
            } else {
                const requiredIds = Array.isArray(foundRole.requiredRoleId) ? foundRole.requiredRoleId : [foundRole.requiredRoleId];
                this.logger.log({ message: `[ReactionAdd] Role requires roles: [${requiredIds.join(', ')}]. Checking member roles. Hierarchy: ${foundRole.hierarchy}` }, true);

                const hasAllRequiredRoles = requiredIds.every(id => member.roles.cache.has(id));

                if (hasAllRequiredRoles) {
                    this.logger.log({ message: `[ReactionAdd] Member has all required roles. Eligible.` }, true);
                    isEligible = true;
                } else {
                    // hierarchy check - if user has higher tier role, they can get lower tier ones
                    this.logger.log({ message: `[ReactionAdd] Member does not have all required roles. Checking hierarchy logic.` }, true);
                    const memberRoles = member.roles.cache;
                    const userHierarchies = foundCategoryRoles
                        .filter(r => {
                            if (!r.requiredRoleId) return false;
                            const rRequiredIds = Array.isArray(r.requiredRoleId) ? r.requiredRoleId : [r.requiredRoleId];
                            return memberRoles.has(r.roleId) || rRequiredIds.every(id => memberRoles.has(id));
                        })
                        .map(r => r.hierarchy);

                    const highestUserHierarchy = userHierarchies.length > 0 ? Math.max(...userHierarchies) : 0;
                    this.logger.log({ message: `[ReactionAdd] Highest hierarchy for user in this category is ${highestUserHierarchy}. Required hierarchy for new role is ${foundRole.hierarchy}.` }, true);

                    if (highestUserHierarchy > 0 && foundRole.hierarchy < highestUserHierarchy) {
                        this.logger.log({ message: `[ReactionAdd] User's hierarchy is higher than role's hierarchy. Eligible.` }, true);
                        isEligible = true;
                    }
                }
            }

            this.logger.log({ message: `[ReactionAdd] User ${user.id} eligibility is: ${isEligible}` }, true);

            if (isEligible) {
                try {
                    this.logger.log({ message: `[ReactionAdd] Adding role ${foundRole.roleId} to user ${user.id}` }, true);
                    await member.roles.add(foundRole.roleId);
                    const role = await guild.roles.fetch(foundRole.roleId);
                    if (role) {
                        this.logReactionRoleChange(member, role, 'added');
                    }
                } catch (error) {
                    this.logger.error({ message: `[ReactionAdd] Failed to add role ${foundRole.roleId} to user ${user.id}`, error });
                }
            } else {
                 try {
                    // remove their reaction if they're not eligible
                    this.logger.log({ message: `[ReactionAdd] User not eligible. Removing reaction for user ${user.id}` }, true);
                    await reaction.users.remove(user.id);
                 } catch (error) {
                    this.logger.error({ message: `[ReactionAdd] Failed to remove reaction for user ${user.id}`, error});
                 }
            }
        });

        this.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    this.logger.error({ message: '[ReactionRemove] Failed to fetch partial reaction for removal:', error });
                    return;
                }
            }

            const activeMessages = await readJsonFile<ActiveMessages>(activeMessagesFilePath);
            let messageData = activeMessages[reaction.message.id];
            if (!messageData) return;

            // Handle both old format (direct categories) and new format (object with categories property)
            let categories: string[];
            if (typeof messageData === 'string') {
                categories = [messageData];
            } else if (Array.isArray(messageData)) {
                categories = messageData;
            } else if (typeof messageData === 'object' && 'categories' in messageData && messageData.categories) {
                categories = Array.isArray(messageData.categories) ? messageData.categories : [messageData.categories];
            } else {
                this.logger.log({ message: `[ReactionRemove] Invalid message data format for message ${reaction.message.id}` }, true);
                return;
            }


            const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);
            const emojiIdentifier = reaction.emoji.name;

            let foundRole: ReactionRole | undefined;

            for (const category of categories) {
                const categoryRoles = reactionRolesData[category];
                if (!categoryRoles) continue;

            const reactionRole = categoryRoles.find(r => r.emoji === emojiIdentifier);
                if (reactionRole) {
                    foundRole = reactionRole;
                    break;
                }
            }

            if (!foundRole) return;

            const guild = reaction.message.guild;
            if (!guild) return;

            try {
                const member = await guild.members.fetch(user.id);
                if (member.roles.cache.has(foundRole.roleId)) {
                    this.logger.log({ message: `[ReactionRemove] Removing role ${foundRole.roleId} from user ${user.id}` }, true);
                    const role = await guild.roles.fetch(foundRole.roleId);
                    await member.roles.remove(foundRole.roleId);
                    if (role) {
                        this.logReactionRoleChange(member, role, 'removed');
                    }
                }
            } catch (error) {
                this.logger.error({ message: `[ReactionRemove] Failed to remove role ${foundRole.roleId} from user ${user.id}`, error });
            }
        });

        process.on('unhandledRejection', (err: any): void => {
            this.logger.error({ message: `UnhandledRejection from Process`, error: err.stack });
        });

        ['beforeExit', 'SIGUSR1', 'SIGUSR2', 'SIGINT', 'SIGTERM'].map((event: string) => process.once(event, this.exit.bind(this)));
    }

    async login() {
        if (!this.dataSource.isInitialized) {
            await this.dataSource.initialize().then(() => {
                this.logger.log({ message: "Data Source has been initialized!" }, true)
            }).catch((err) => {
                this.logger.error({ message: `Error during Data Source initialization`, error: err.stack });
                process.exit(1);
            });
        }
        await this.events.build();
        await super.login(process.env.TOKEN);
        return this.constructor.name;
    }

    async cacheTrackedMessages() {
        const activeMessages = await readJsonFile<ActiveMessages>(activeMessagesFilePath);
        const messageIds = Object.keys(activeMessages);
        if (messageIds.length === 0) {
            this.logger.log({ message: `[Cache] No tracked messages to cache.` }, true);
            return;
        }

        this.logger.log({ message: `[Cache] Caching ${messageIds.length} tracked messages...` }, true);

        let cachedCount = 0;

        for (const guild of this.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (channel.isTextBased()) {
                    const textChannel = channel as TextChannel;
                    // Attempt to fetch each message individually.
                    // This is inefficient but reliable.
                    for (const messageId of messageIds) {
                        try {
                            await textChannel.messages.fetch(messageId);
                            // If fetch is successful, the message is in this channel and now cached.
                            cachedCount++;
                            // Optional: remove the id from messageIds to avoid re-fetching in other channels
                        } catch {
                            // Ignore errors (message not in this channel, or other access issues)
                        }
                    }
                }
            }
        }
        this.logger.log({ message: `[Cache] Successfully cached ${cachedCount} out of ${messageIds.length} messages.`}, true);
    }

    exit() {
        if (this.quitting) return;
        this.quitting = true;
        this.destroy();
    }

    async logReactionRoleChange(member: GuildMember, role: Role, action: 'added' | 'removed') {
        try {
            const logChannel = await this.channels.fetch(LOG_CHANNEL_ID) as TextChannel;
            if (!logChannel) return;

            const preposition = action === 'added' ? 'to' : 'from';
            const embed = new EmbedBuilder()
                .setDescription(`${role} was ${action} ${preposition} ${member.user} via reaction role.`)
                .setColor(this.color)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            this.logger.error({ message: `Failed to send reaction role log`, error });
        }
    }
}
