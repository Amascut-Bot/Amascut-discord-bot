import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';
import Bot from "../../Bot";

const reactionRolesFilePath = path.join(process.cwd(), 'reaction-roles.json');

interface ReactionRole {
    emoji: string;
    roleId: string;
    hierarchy: number;
    requiredRoleId: string | string[] | null;
}

interface ReactionRolesData {
    [category: string]: ReactionRole[];
}

async function readReactionRoles(): Promise<ReactionRolesData> {
    try {
        await fs.access(reactionRolesFilePath);
        const data = await fs.readFile(reactionRolesFilePath, 'utf-8');
        return JSON.parse(data) as ReactionRolesData;
    } catch (error) {
        return {};
    }
}

export default class ListReactionRole extends BotInteraction {

    constructor(client: Bot) {
        super(client);
        this.category = 'reaction-roles';
    }

    get name(): string {
        return 'list-reaction-role';
    }

    get description(): string {
        return 'Lists all configured reaction roles by category.';
    }

    get permissions(): string {
        return '';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const reactionRoles = await readReactionRoles();
        const categories = Object.keys(reactionRoles);

        if (categories.length === 0) {
            return interaction.editReply({ content: 'There are no reaction roles configured yet.' });
        }

        const embeds: EmbedBuilder[] = [];
        let currentEmbed = new EmbedBuilder()
            .setColor(this.client.color)
            .setTitle('Configured Reaction Roles')
            .setTimestamp();

        let currentLength = 0;

        for (const category of categories) {
            const roles = reactionRoles[category];
            if (roles.length === 0) continue;

            const header = {
                emoji: 'Emoji',
                role: 'Role Given (H)',
                required: 'Role Required'
            };

            const roleData = roles.map(r => {
                let requiredDisplay = 'None';
                if (r.requiredRoleId) {
                    if (Array.isArray(r.requiredRoleId)) {
                        requiredDisplay = r.requiredRoleId.map(id => interaction.guild?.roles.cache.get(id)?.name || id).join(', ');
                    } else {
                        requiredDisplay = interaction.guild?.roles.cache.get(r.requiredRoleId)?.name || r.requiredRoleId;
                    }
                }
                return {
                    emoji: r.emoji,
                    role: `${interaction.guild?.roles.cache.get(r.roleId)?.name || r.roleId} (H: ${r.hierarchy})`,
                    required: requiredDisplay
                };
            });

            const emojiWidth = Math.max(header.emoji.length, ...roleData.map(r => r.emoji.length));
            const roleWidth = Math.max(header.role.length, ...roleData.map(r => r.role.length));

            let table = '```\n';
            table += `${header.emoji.padEnd(emojiWidth)} | ${header.role.padEnd(roleWidth)} | ${header.required}\n`;
            table += `${'-'.repeat(emojiWidth)} | ${'-'.repeat(roleWidth)} | ${'-'.repeat(header.required.length)}\n`;

            roleData.forEach(r => {
                table += `${r.emoji.padEnd(emojiWidth)} | ${r.role.padEnd(roleWidth)} | ${r.required}\n`;
            });

            table += '```';

            const fieldName = `Category: ${category}`;
            const fieldValue = table;
            const fieldLength = fieldName.length + fieldValue.length;

            if (currentLength + fieldLength > 5500 || currentEmbed.data.fields?.length === 25) { // Leave some buffer
                embeds.push(currentEmbed);
                currentEmbed = new EmbedBuilder()
                    .setColor(this.client.color)
                    .setTitle('Configured Reaction Roles (Cont.)');
                currentLength = 0;
            }

            currentEmbed.addFields({ name: fieldName, value: fieldValue });
            currentLength += fieldLength;
        }

        embeds.push(currentEmbed);

        await interaction.editReply({ embeds });

        for (let i = 1; i < embeds.length; i++) {
            await interaction.followUp({ embeds: [embeds[i]] });
        }
    }
}
