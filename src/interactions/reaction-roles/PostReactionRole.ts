import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role, TextChannel, AutocompleteInteraction } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';
import Bot from "../../Bot";

const reactionRolesFilePath = path.join(process.cwd(), 'reaction-roles.json');
const activeMessagesFilePath = path.join(process.cwd(), 'active-reaction-messages.json');

interface ReactionRole {
    emoji: string;
    roleId: string;
    tier: number;
    requiredRoleId: string | null;
}

interface ReactionRolesData {
    [category: string]: ReactionRole[];
}

interface ActiveMessages {
    [messageId: string]: string | string[];
}

interface NewActiveMessage {
    channelId: string;
    categories: string[];
}

interface NewActiveMessages {
    [messageId:string]: NewActiveMessage;
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

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export default class PostReactionRole extends BotInteraction {

    constructor(client: Bot) {
        super(client);
        this.category = 'reaction-roles';
    }

    get name(): string {
        return 'post-reaction-role';
    }

    get description(): string {
        return 'Posts the reaction roles for a category to a specific message.';
    }

    get permissions(): string {
        return '';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('category')
                    .setDescription('The category of reaction roles to post.')
                    .setAutocomplete(true)
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('message-id')
                    .setDescription('The ID of the message to add reactions to.')
                    .setRequired(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        if (interaction.options.getFocused(true).name === 'category') {
            const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);
            const categories = Object.keys(reactionRolesData);
            const focusedValue = interaction.options.getFocused();
            const filtered = categories.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase())).slice(0, 25);
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })),
            );
        }
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }
        const category = interaction.options.getString('category', true);
        const messageId = interaction.options.getString('message-id', true);

        await interaction.deferReply({ ephemeral: true });

        const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);
        const categoryRoles = reactionRolesData[category];

        if (!categoryRoles || categoryRoles.length === 0) {
            return interaction.editReply({ content: `The category '${category}' does not exist or has no roles.` });
        }

        let message;
        try {
            const channels = await interaction.guild.channels.fetch();
            for (const channel of channels.values()) {
                if (channel instanceof TextChannel) {
                    try {
                        message = await channel.messages.fetch(messageId);
                        if (message) break;
                    } catch (e) {
                        // Message not in this channel, continue
                    }
                }
            }

            if (!message) {
                throw new Error("Message not found");
            }

        } catch (error) {
            const activeMessages = await readJsonFile<NewActiveMessages>(activeMessagesFilePath);
            if (activeMessages[messageId]) {
                delete activeMessages[messageId];
                await writeJsonFile(activeMessagesFilePath, activeMessages);
                return interaction.editReply({ content: `Could not find message with ID ${messageId}. It has been removed from the tracking list.` });
            }
            return interaction.editReply({ content: `Could not find message with ID ${messageId} in any channel.` });
        }

        for (const role of categoryRoles) {
            try {
                const emoji = this.client.emojis.cache.find(e => e.name === role.emoji) || role.emoji;
                await message.react(emoji);
            } catch (e) {
                this.client.logger.error({ message: `Failed to react with emoji: ${role.emoji}`, error: e });
            }
        }

        const activeMessages = await readJsonFile<NewActiveMessages>(activeMessagesFilePath);

        const messageData = activeMessages[messageId] || {
            channelId: message.channel.id,
            categories: [],
        };

        if (!messageData.categories.includes(category)) {
            messageData.categories.push(category);
        }

        activeMessages[messageId] = messageData;

        try {
            await fs.writeFile(activeMessagesFilePath, JSON.stringify(activeMessages, null, 2));
            this.client.logger.log({ message: `[ReactionRole] Wrote to active-reaction-messages.json. Tracked messages: ${Object.keys(activeMessages).length}` }, true);
        } catch (error) {
            this.client.logger.error({ message: '[ReactionRole] Failed to write to active-reaction-messages.json:', error });
            await interaction.followUp({ content: 'An error occurred while saving the active message data.', ephemeral: true });
        }

        await interaction.editReply({ content: `Successfully posted reaction roles for category '${category}' on message ${messageId}.` });
    }
}
