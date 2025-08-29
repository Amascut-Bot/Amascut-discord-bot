import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role, GuildMember, AutocompleteInteraction, TextChannel, EmbedBuilder } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import Bot from "../../Bot";

const LOG_CHANNEL_ID = '1045192967754883172';

export default class RoleReplace extends BotInteraction {

    constructor(client: Bot) {
        super(client);
        this.category = 'moderation';
    }

    get name(): string {
        return 'role-replace';
    }

    get description(): string {
        return 'Replaces a role for a single user or all users who have it.';
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
                option.setName('current-role')
                    .setDescription('The role to be replaced.')
                    .setRequired(true))
            .addRoleOption(option =>
                option.setName('desired-role')
                    .setDescription('The new role to be assigned.')
                    .setRequired(true))
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to replace the role for. (Optional)'))
            .addStringOption(option =>
                option.setName('mass')
                    .setDescription('Set to "True" to replace the role for everyone. (Default: False)')
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

        await interaction.deferReply({ ephemeral: true });

        const currentRole = interaction.options.getRole('current-role', true) as Role;
        const desiredRole = interaction.options.getRole('desired-role', true) as Role;
        const user = interaction.options.getMember('user') as GuildMember | null;
        const massReplace = interaction.options.getString('mass') === 'True';

        if (!user && !massReplace) {
            return interaction.editReply({
                content: "Invalid command usage. You must either specify a 'user' to replace the role for, or set 'mass' to 'True' to replace it for everyone."
            });
        }

        if (user) {
            if (!user.roles.cache.has(currentRole.id)) {
                return interaction.editReply({ content: `${user.displayName} does not have the ${currentRole.name} role.` });
            }

            try {
                await user.roles.remove(currentRole);
                await user.roles.add(desiredRole);
                this.sendLog(interaction, currentRole, desiredRole, user, false);
                return interaction.editReply({ content: `Successfully replaced the ${currentRole.name} role with ${desiredRole.name} for ${user.displayName}.` });
            } catch (error) {
                this.client.logger.error({ message: `Failed to replace role for ${user.displayName}`, error });
                return interaction.editReply({ content: `There was an error trying to replace the role. Please check my permissions and the role hierarchy.` });
            }
        }

        if (massReplace) {
            try {
                await interaction.editReply({ content: `Fetching members with the ${currentRole.name} role... This might take a while.` });

                await interaction.guild.members.fetch();

                const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(currentRole.id));

                if (membersWithRole.size === 0) {
                    return interaction.followUp({ content: `No one has the ${currentRole.name} role.`, ephemeral: true });
                }

                await interaction.followUp({ content: `Found ${membersWithRole.size} members. Starting role replacement...`, ephemeral: true });

                let successCount = 0;
                let errorCount = 0;

                for (const member of membersWithRole.values()) {
                    try {
                        await member.roles.remove(currentRole);
                        await member.roles.add(desiredRole);
                        this.sendLog(interaction, currentRole, desiredRole, member, true);
                        successCount++;
                    } catch {
                        errorCount++;
                    }
                }

                return interaction.followUp({ content: `Mass replacement complete. Replaced the ${currentRole.name} role with ${desiredRole.name} for ${successCount} members. Failed to replace for ${errorCount} members.`, ephemeral: true });

            } catch (error) {
                this.client.logger.error({ message: `Failed mass role replacement for role ${currentRole.name}`, error });
                return interaction.followUp({ content: `An unexpected error occurred during mass replacement.`, ephemeral: true });
            }
        }
    }

    private async sendLog(interaction: ChatInputCommandInteraction, currentRole: Role, desiredRole: Role, member: GuildMember, isMass: boolean) {
        try {
            const logChannel = await this.client.channels.fetch(LOG_CHANNEL_ID) as TextChannel;
            if (!logChannel) return;

            const description = isMass
                ? `${currentRole} was replaced with ${desiredRole} for ${member.user} by ${interaction.user} in a mass replacement.`
                : `${currentRole} was replaced with ${desiredRole} for ${member.user} by ${interaction.user}.`;

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor(this.client.color)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error({ message: `Failed to send role replacement log`, error });
        }
    }
}
