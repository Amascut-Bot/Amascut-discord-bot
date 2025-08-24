import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, Role, APIRole, RoleCreateOptions, PermissionsBitField, PermissionFlagsBits, RoleColors } from 'discord.js';

export default class CopyRole extends BotInteraction {
    get name() {
        return 'copy-role';
    }

    get description() {
        return 'Copies a role';
    }

    get permissions() {
        return 'ManageRoles';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addRoleOption((option) => option.setName('role').setDescription('Role to Copy').setRequired(true))
            .addStringOption((option) => option.setName('name').setDescription('Name of the copied Role').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const role: APIRole | Role = interaction.options.getRole('role', true);
        const name: string = interaction.options.getString('name', true);

        const roleCreateOption: RoleCreateOptions = {
            hoist: role.hoist,
            icon: role.icon,
            mentionable: role.mentionable,
            name: name,
            permissions: role.permissions as PermissionsBitField,
            position: role.position,
            reason: 'Copy-Role command'
        }

        const newRole = await interaction.guild?.roles.create(roleCreateOption);

        if (role.colors) {
            const roleColours = role.colors as RoleColors;

            await newRole?.setColors({
                    primaryColor: roleColours.primaryColor,
                    secondaryColor: roleColours.secondaryColor ?? undefined,
                    tertiaryColor: roleColours.tertiaryColor ?? undefined
                });
        }

        await interaction.editReply(`Successfully created role <@&${newRole?.id}>`);
    }
}
