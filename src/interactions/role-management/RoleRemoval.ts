import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role, GuildMember, AutocompleteInteraction, TextChannel, EmbedBuilder, MessageFlags } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import Bot from "../../Bot";

const reactionRoleLog = '1390351711868158102';

export default class RoleRemoval extends BotInteraction {

    constructor(client: Bot) {
        super(client);
        this.category = 'moderation';
    }

    get name(): string {
        return 'role-removal';
    }

    get description(): string {
        return 'Removes a role from a single user or all users who have it.';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('The role to remove.')
                    .setRequired(true))
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to remove the role from. (Optional)'))
            .addStringOption(option =>
                option.setName('mass')
                    .setDescription('Set to "True" to remove the role from everyone. (Default: False)')
                    .setAutocomplete(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'mass') {
            const choices = ['True', 'False'];
            const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })),
            );
        }
        return;
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const role = interaction.options.getRole('role', true) as Role;
        const user = interaction.options.getMember('user') as GuildMember | null;
        const massRemove = interaction.options.getString('mass') === 'True';

        if (!user && !massRemove) {
            return interaction.editReply({
                content: "Invalid command usage. You must either specify a 'user' to remove the role from, or set 'mass' to 'True' to remove it from everyone."
            });
        }

        if (user) {
            if (!user.roles.cache.has(role.id)) {
                return interaction.editReply({ content: `${user.displayName} does not have the ${role.name} role.` });
            }

            try {
                await user.roles.remove(role);
                this.sendLog(interaction, role, user, false);
                return interaction.editReply({ content: `Successfully removed the ${role.name} role from ${user.displayName}.` });
            } catch (error) {
                this.client.logger.error({ message: `Failed to remove role from ${user.displayName}`, error });
                return interaction.editReply({ content: `There was an error trying to remove the role. Please check my permissions and the role hierarchy.` });
            }
        }

        if (massRemove) {
            try {
                await interaction.editReply({ content: `Fetching members with the ${role.name} role... This might take a while.` });

                // Fetch all members to ensure cache is up-to-date
                await interaction.guild.members.fetch();

                const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));

                if (membersWithRole.size === 0) {
                    return interaction.followUp({ content: `No one has the ${role.name} role.`, flags: MessageFlags.Ephemeral });
                }

                await interaction.followUp({ content: `Found ${membersWithRole.size} members. Starting role removal...`, flags: MessageFlags.Ephemeral });

                let successCount = 0;
                let errorCount = 0;

                for (const member of membersWithRole.values()) {
                    try {
                        await member.roles.remove(role);
                        this.sendLog(interaction, role, member, true);
                        successCount++;
                    } catch {
                        errorCount++;
                    }
                }

                return interaction.followUp({ content: `Mass removal complete. Removed the ${role.name} role from ${successCount} members. Failed to remove from ${errorCount} members.`, flags: MessageFlags.Ephemeral });

            } catch (error) {
                this.client.logger.error({ message: `Failed mass role removal for role ${role.name}`, error });
                return interaction.followUp({ content: `An unexpected error occurred during mass removal.`, flags: MessageFlags.Ephemeral });
            }
        }
    }

    private async sendLog(interaction: ChatInputCommandInteraction, role: Role, member: GuildMember, isMass: boolean) {
        try {
            const logChannel = await this.client.channels.fetch(reactionRoleLog) as TextChannel;
            if (!logChannel) return;

            const description = isMass
                ? `${role} was removed from ${member.user} by ${interaction.user} in a mass removal.`
                : `${role} was removed from ${member.user} by ${interaction.user}.`;

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor(this.client.color)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error({ message: `Failed to send role removal log`, error });
        }
    }
}
