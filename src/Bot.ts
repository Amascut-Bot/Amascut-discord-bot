import 'dotenv/config';
import { Client, ClientOptions, MessageReaction, PartialMessageReaction, User, PartialUser, Role, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import BotLogger from './modules/LoggingHandler';
import InteractionHandler from './modules/InteractionHandler';
import EventHandler from './modules/EventHandler';
import UtilityHandler from './modules/UtilityHandler';
import TempChannelManager from './modules/TempVCHandler';
import { DataSource } from "typeorm"
import { AppDataSource } from './DataSource';
import * as fs from 'fs/promises';
import * as path from 'path';

// Interfaces and helpers for Reaction Roles
const reactionRolesFilePath = path.join(process.cwd(), 'reaction-roles.json');
const activeMessagesFilePath = path.join(process.cwd(), 'active-reaction-messages.json');
const LOG_CHANNEL_ID = '1045192967754883172';

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
    [messageId: string]: string;
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
    tempManager: TempChannelManager;
}

export default class Bot extends Client {
    constructor(options: ClientOptions) {
        super(options);

        this.color = 0x7e686c;
        this.dataSource = AppDataSource;
        this.commandsRun = 0;
        this.util = new UtilityHandler(this);
        this.quitting = false;
        this.location = process.cwd();
        this.logger = new BotLogger();
        this.tempManager = new TempChannelManager(this);
        this.interactions = new InteractionHandler(this).build();
        this.events = new EventHandler(this);

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
    
            const activeMessages = await readJsonFile<ActiveMessages>(activeMessagesFilePath);
            const category = activeMessages[reaction.message.id];

            if (!category) {
                return;
            }
            this.logger.log({ message: `[ReactionAdd] Found category '${category}' for message ${reaction.message.id}` }, true);
    
            const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);
            const categoryRoles = reactionRolesData[category];

            if (!categoryRoles) {
                this.logger.log({ message: `[ReactionAdd] No roles found for category '${category}'. Aborting.` }, true);
                return;
            }
            this.logger.log({ message: `[ReactionAdd] Found ${categoryRoles.length} roles for category '${category}'` }, true);
    
            const emojiIdentifier = reaction.emoji.name;
            const reactionRole = categoryRoles.find(r => r.emoji === emojiIdentifier);

            if (!reactionRole) {
                this.logger.log({ message: `[ReactionAdd] No role found for emoji '${emojiIdentifier}' in category '${category}'. Aborting.` }, true);
                return;
            }
            this.logger.log({ message: `[ReactionAdd] Matched emoji '${emojiIdentifier}' to roleId ${reactionRole.roleId}` }, true);
            
            const guild = reaction.message.guild;
            if (!guild) return;
            const member = await guild.members.fetch(user.id);
    
            let isEligible = false;
            if (!reactionRole.requiredRoleId) {
                this.logger.log({ message: `[ReactionAdd] Role has no requiredRoleId. Eligible. Hierarchy: ${reactionRole.hierarchy}` }, true);
                isEligible = true;
            } else {
                this.logger.log({ message: `[ReactionAdd] Role requires role ${reactionRole.requiredRoleId}. Checking member roles. Hierarchy: ${reactionRole.hierarchy}` }, true);
                if (member.roles.cache.has(reactionRole.requiredRoleId)) {
                    this.logger.log({ message: `[ReactionAdd] Member has the required role. Eligible.` }, true);
                    isEligible = true;
                } else {
                    this.logger.log({ message: `[ReactionAdd] Member does not have the required role. Checking hierarchy logic.` }, true);
                    const memberRoles = member.roles.cache;
                    const userHierarchies = categoryRoles
                        .filter(r => memberRoles.has(r.roleId) || (r.requiredRoleId && memberRoles.has(r.requiredRoleId)))
                        .map(r => r.hierarchy);
                    
                    const highestUserHierarchy = userHierarchies.length > 0 ? Math.max(...userHierarchies) : 0;
                    this.logger.log({ message: `[ReactionAdd] Highest hierarchy for user in this category is ${highestUserHierarchy}. Required hierarchy for new role is ${reactionRole.hierarchy}.` }, true);
    
                    if (highestUserHierarchy > 0 && reactionRole.hierarchy < highestUserHierarchy) {
                        this.logger.log({ message: `[ReactionAdd] User's hierarchy is higher than role's hierarchy. Eligible.` }, true);
                        isEligible = true;
                    }
                }
            }

            this.logger.log({ message: `[ReactionAdd] User ${user.id} eligibility is: ${isEligible}` }, true);
    
            if (isEligible) {
                try {
                    this.logger.log({ message: `[ReactionAdd] Adding role ${reactionRole.roleId} to user ${user.id}` }, true);
                    await member.roles.add(reactionRole.roleId);
                    const role = await guild.roles.fetch(reactionRole.roleId);
                    if (role) {
                        this.logReactionRoleChange(member, role, 'added');
                    }
                } catch (error) {
                    this.logger.error({ message: `[ReactionAdd] Failed to add role ${reactionRole.roleId} to user ${user.id}`, error });
                }
            } else {
                 try {
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
            const category = activeMessages[reaction.message.id];
            if (!category) return;
    
            const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);
            const categoryRoles = reactionRolesData[category];
            if (!categoryRoles) return;
    
            const emojiIdentifier = reaction.emoji.name;
            const reactionRole = categoryRoles.find(r => r.emoji === emojiIdentifier);
            if (!reactionRole) return;
    
            const guild = reaction.message.guild;
            if (!guild) return;
            
            try {
                const member = await guild.members.fetch(user.id);
                if (member.roles.cache.has(reactionRole.roleId)) {
                    this.logger.log({ message: `[ReactionRemove] Removing role ${reactionRole.roleId} from user ${user.id}` }, true);
                    const role = await guild.roles.fetch(reactionRole.roleId);
                    await member.roles.remove(reactionRole.roleId);
                    if (role) {
                        this.logReactionRoleChange(member, role, 'removed');
                    }
                }
            } catch (error) {
                this.logger.error({ message: `[ReactionRemove] Failed to remove role ${reactionRole.roleId} from user ${user.id}`, error });
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
                this.logger.log({ message: "Data Source has been initialized!" }, false)
            }).catch((err) => {
                this.logger.error({ message: `Error during Data Source initialization`, error: err.stack });
                process.exit(1);
            });
        }
        await this.events.build();
        await super.login(process.env.TOKEN);
        return this.constructor.name;
    }

    exit() {
        if (this.quitting) return;
        this.quitting = true;
        this.destroy();
    }

    private async logReactionRoleChange(member: GuildMember, role: Role, action: 'added' | 'removed') {
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
