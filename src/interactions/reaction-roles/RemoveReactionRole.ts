import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, AutocompleteInteraction } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';
import Bot from "../../Bot";

const reactionRolesFilePath = path.join(process.cwd(), 'reaction-roles.json');
const activeMessagesFilePath = path.join(process.cwd(), 'active-reaction-messages.json');

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
    [messageId: string]: string | string[];
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

export default class RemoveReactionRole extends BotInteraction {

    constructor(client: Bot) {
        super(client);
        this.category = 'reaction-roles';
    }

    get name(): string {
        return 'remove-reaction-role';
    }

    get description(): string {
        return 'Removes a reaction role and updates any active messages.';
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
                    .setDescription('The category of the role to remove.')
                    .setAutocomplete(true)
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('role')
                    .setDescription('The role to remove.')
                    .setAutocomplete(true)
                    .setRequired(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        const reactionRolesData = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);

        if (focusedOption.name === 'category') {
            const categories = Object.keys(reactionRolesData);
            const filtered = categories.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase())).slice(0, 25);
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })),
            );
        }

        if (focusedOption.name === 'role') {
            const category = interaction.options.getString('category');
            if (!category || !reactionRolesData[category]) {
                await interaction.respond([]);
                return;
            }

            const roles = reactionRolesData[category];
            const filtered = roles.filter(role => {
                const roleName = interaction.guild?.roles.cache.get(role.roleId)?.name || role.roleId;
                return roleName.toLowerCase().startsWith(focusedOption.value.toLowerCase());
            }).slice(0, 25);

            await interaction.respond(
                filtered.map(role => ({
                    name: interaction.guild?.roles.cache.get(role.roleId)?.name || role.roleId,
                    value: role.roleId
                }))
            );
        }
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        await interaction.deferReply({ ephemeral: true });

        const category = interaction.options.getString('category', true);
        const roleIdToRemove = interaction.options.getString('role', true);

        const reactionRoles = await readJsonFile<ReactionRolesData>(reactionRolesFilePath);

        if (!reactionRoles[category]) {
            return interaction.editReply({ content: `Category '${category}' not found.` });
        }

        const roleIndex = reactionRoles[category].findIndex(r => r.roleId === roleIdToRemove);
        if (roleIndex === -1) {
            return interaction.editReply({ content: `Role not found in category '${category}'.` });
        }

        const [removedRole] = reactionRoles[category].splice(roleIndex, 1);
        const removedEmoji = removedRole.emoji;

        const activeMessages = await readJsonFile<ActiveMessages>(activeMessagesFilePath);

        const messagesToUpdate = Object.keys(activeMessages).filter(msgId => {
            const categories = activeMessages[msgId];
            if (Array.isArray(categories)) {
                return categories.includes(category);
            }
            return categories === category;
        });

        if (reactionRoles[category] && reactionRoles[category].length === 0) {
            delete reactionRoles[category];
            for (const msgId in activeMessages) {
                let categories = activeMessages[msgId];
                if (Array.isArray(categories)) {
                    const index = categories.indexOf(category);
                    if (index > -1) {
                        categories.splice(index, 1);
                    }
                    if (categories.length === 0) {
                        delete activeMessages[msgId];
                    }
                } else if (categories === category) {
                    delete activeMessages[msgId];
                }
            }
        } else if (reactionRoles[category]) {
            reactionRoles[category].sort((a, b) => a.hierarchy - b.hierarchy);
            reactionRoles[category].forEach((role, index) => {
                role.hierarchy = index + 1;
            });
        }

        await writeJsonFile(reactionRolesFilePath, reactionRoles);
        await writeJsonFile(activeMessagesFilePath, activeMessages);

        for (const messageId of messagesToUpdate) {
            try {
                const channels = await interaction.guild.channels.fetch();
                for (const channel of channels.values()) {
                    if (!channel) continue;
                    if (channel.isTextBased()) {
                        try {
                            const message = await channel.messages.fetch(messageId);
                            const emojiIdentifier = interaction.guild.emojis.cache.find(e => e.name === removedEmoji) || removedEmoji;
                            if (emojiIdentifier) {
                                const reaction = message.reactions.cache.get(typeof emojiIdentifier === 'string' ? emojiIdentifier : emojiIdentifier.id);
                                if (reaction) {
                                    await reaction.remove();
                                }
                            }
                            break;
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            } catch (error) {
                this.client.logger.error({ message: `Could not update reactions on message ${messageId}`, error });
            }
        }

        const roleName = interaction.guild.roles.cache.get(roleIdToRemove)?.name || 'Unknown Role';
        await interaction.editReply({ content: `Successfully removed the role '${roleName}' from the '${category}' category and updated active messages.` });
    }
}
