import 'dotenv/config';
import { Client, ClientOptions, MessageReaction, PartialMessageReaction, User, PartialUser, Role, GuildMember, TextChannel, EmbedBuilder, GuildEmoji } from 'discord.js';
import BotLogger from './modules/LoggingHandler';
import InteractionHandler from './modules/InteractionHandler';
import EventHandler from './modules/EventHandler';
import UtilityHandler from './modules/UtilityHandler';
import TwitchHandler from './modules/TwitchHandler';
import TempChannelManager from './modules/TempVCHandler';
import AutoTriggerHandler from './modules/AutoTriggerHandler';
import URLReactionHandler from './modules/URLReactionHandler';
import ForumTodoHandler from './modules/ForumTodoHandler';
import ReminderHandler from './modules/ReminderHandler';
import GoogleSheetsHandler from './modules/GoogleSheetsHandler';
import { DataSource } from "typeorm"
import { AppDataSource } from './DataSource';
import { getChannels } from './GuildSpecifics';

// Interfaces and helpers for Reaction Roles
const LOG_CHANNEL_ID = getChannels(process.env.GUILD_ID).LOG_CHANNEL_ID;

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
    reminderHandler: ReminderHandler;
    googleSheetsHandler: GoogleSheetsHandler;
    tempManager?: TempChannelManager;
    emojiCache: Map<string, GuildEmoji>;
    tempSubmissionData?: Map<string, any>;
}

export default class Bot extends Client {
    constructor(options: ClientOptions) {
        super(options);

        this.color = 10454367; // solak color scheme
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
        this.reminderHandler = new ReminderHandler(this);
        this.googleSheetsHandler = new GoogleSheetsHandler(this);
        this.interactions = new InteractionHandler(this).build();
        this.events = new EventHandler(this);
        this.emojiCache = new Map<string, GuildEmoji>();
        this.tempSubmissionData = new Map<string, any>(); // temp storage for multi-step processes

        // TODO: might want to move this reaction role stuff to its own handler
        // Direct Reaction Role Listeners
        this.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
            if (user.bot) return;

            if (reaction.partial) {
                await reaction.fetch().catch(error => {
                    this.logger.error({ message: '[ReactionAdd] Failed to fetch partial reaction:', error });
                    return;
                });
            }

            // Handle forum todo completion
            if (await this.forumTodoHandler.handleForumTodoReaction(reaction, user)) {
                return;
            }
        });

        this.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
            if (user.bot) return;
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
