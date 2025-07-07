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
                    .setDescription('A role a user must have to receive the role-given.'))
            .addRoleOption(option =>
                option.setName('required_role_2')
                    .setDescription('A second role a user must have to receive the role-given.'))
            .addRoleOption(option =>
                option.setName('required_role_3')
                    .setDescription('A third role a user must have to receive the role-given.'))
            .addRoleOption(option =>
                option.setName('required_role_4')
                    .setDescription('A fourth role a user must have to receive the role-given.'));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const category = interaction.options.getString('category', true);
        const emojiInput = interaction.options.getString('emoji', true);
        const roleGiven = interaction.options.getRole('role-given', true) as Role;
        const hierarchy = interaction.options.getInteger('hierarchy');
        
        const requiredRoles: Role[] = [];
        const requiredRole1 = interaction.options.getRole('required-role') as Role | null;
        if (requiredRole1) requiredRoles.push(requiredRole1);
        const requiredRole2 = interaction.options.getRole('required_role_2') as Role | null;
        if (requiredRole2) requiredRoles.push(requiredRole2);
        const requiredRole3 = interaction.options.getRole('required_role_3') as Role | null;
        if (requiredRole3) requiredRoles.push(requiredRole3);
        const requiredRole4 = interaction.options.getRole('required_role_4') as Role | null;
        if (requiredRole4) requiredRoles.push(requiredRole4);

        await interaction.deferReply({ ephemeral: true });

        const emojiMatch = emojiInput.match(/<a?:(\w+):\d+>/);
        const emoji = emojiMatch ? emojiMatch[1] : emojiInput;

        const reactionRoles = await readReactionRoles();

        if (!reactionRoles[category]) {
            reactionRoles[category] = [];
        }

        const newHierarchy = hierarchy ?? (reactionRoles[category].length > 0 ? Math.max(...reactionRoles[category].map(rr => rr.hierarchy)) + 1 : 1);

        if (hierarchy !== null) {
            reactionRoles[category].sort((a, b) => b.hierarchy - a.hierarchy);
            reactionRoles[category].forEach(role => {
                if (role.hierarchy >= newHierarchy) {
                    role.hierarchy += 1;
                }
            });
        }

        const requiredRoleIds = requiredRoles.map(role => role.id);

        const newReactionRole: ReactionRole = {
            emoji: emoji,
            roleId: roleGiven.id,
            hierarchy: newHierarchy,
            requiredRoleId: requiredRoleIds.length > 0 ? requiredRoleIds : null,
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