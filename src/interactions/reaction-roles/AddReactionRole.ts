import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';
import Bot from "../../Bot";

const reactionRolesFilePath = path.join(process.cwd(), 'reaction-roles.json');

interface ReactionRole {
    emoji: string;
    roleId: string;
    hierarchy: number;
    requiredRoleId: string | null;
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
        // If file doesn't exist or other error, return empty object
        return {};
    }
}

async function writeReactionRoles(data: ReactionRolesData): Promise<void> {
    await fs.writeFile(reactionRolesFilePath, JSON.stringify(data, null, 2));
}

export default class AddReactionRole extends BotInteraction {
    
    constructor(client: Bot) {
        super(client);
        this.category = 'reaction-roles';
    }

    get name(): string {
        return 'add-reaction-role';
    }

    get description(): string {
        return 'Adds a new reaction role.';
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
                    .setDescription('The category to group this role under.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('emoji')
                    .setDescription('The emoji for the reaction role.')
                    .setRequired(true))
            .addRoleOption(option =>
                option.setName('role-given')
                    .setDescription('The role to be granted.')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('hierarchy')
                    .setDescription("The hierarchy of this role. Higher hierarchies can claim roles from lower ones."))
            .addRoleOption(option =>
                option.setName('required-role')
                    .setDescription('A role a user must have to receive the role-given.'));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const category = interaction.options.getString('category', true);
        const emojiInput = interaction.options.getString('emoji', true);
        const roleGiven = interaction.options.getRole('role-given', true) as Role;
        const hierarchy = interaction.options.getInteger('hierarchy');
        const requiredRole = interaction.options.getRole('required-role') as Role | null;

        await interaction.deferReply({ ephemeral: true });

        // Extract name from custom emoji string
        const emojiMatch = emojiInput.match(/<a?:(\w+):\d+>/);
        const emoji = emojiMatch ? emojiMatch[1] : emojiInput;

        const reactionRoles = await readReactionRoles();

        if (!reactionRoles[category]) {
            reactionRoles[category] = [];
        }

        const newHierarchy = hierarchy ?? (reactionRoles[category].length > 0 ? Math.max(...reactionRoles[category].map(rr => rr.hierarchy)) + 1 : 1);

        // If a hierarchy is specified, make room for the new role
        if (hierarchy !== null) {
            // Sort descending to avoid overwriting hierarchy values before they are checked
            reactionRoles[category].sort((a, b) => b.hierarchy - a.hierarchy);
            reactionRoles[category].forEach(role => {
                if (role.hierarchy >= newHierarchy) {
                    role.hierarchy += 1;
                }
            });
        }

        const newReactionRole: ReactionRole = {
            emoji: emoji,
            roleId: roleGiven.id,
            hierarchy: newHierarchy,
            requiredRoleId: requiredRole ? requiredRole.id : null,
        };
        
        if (reactionRoles[category].some(rr => rr.emoji === newReactionRole.emoji)) {
            return interaction.editReply({ content: `The emoji ${emojiInput} already exists in the '${category}' category.` });
        }

        if (reactionRoles[category].some(rr => rr.roleId === newReactionRole.roleId)) {
            return interaction.editReply({ content: `The role ${roleGiven.name} already exists in the '${category}' category.` });
        }

        reactionRoles[category].push(newReactionRole);
        reactionRoles[category].sort((a, b) => a.hierarchy - b.hierarchy);

        await writeReactionRoles(reactionRoles);

        await interaction.editReply({ content: `Successfully added the reaction role ${roleGiven.name} with emoji ${emojiInput} to the '${category}' category.` });
    }
} 