import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Role, GuildMember, AutocompleteInteraction, TextChannel, EmbedBuilder, MessageFlags } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import Bot from "../../Bot";

const LOG_CHANNEL_ID = '1045192967754883172';

export default class RoleExtend extends BotInteraction {

    constructor(client: Bot) {
        super(client);
        this.category = 'moderation';
    }

    get name(): string {
        return 'role-extend';
    }

    get description(): string {
        return 'Extends a role for a single user or all users who have it with two other roles.';
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
                    .setDescription('The role to be extended from.')
                    .setRequired(true))
            .addRoleOption(option =>
                option.setName('desired-role-1')
                    .setDescription('The first new role to be assigned.')
                    .setRequired(true))
            .addRoleOption(option =>
                option.setName('desired-role-2')
                    .setDescription('The second new role to be assigned.')
                    .setRequired(true))
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to extend the role for. (Optional)'))
            .addStringOption(option =>
                option.setName('mass')
                    .setDescription('Set to "True" to extend the role for everyone. (Default: False)')
                    .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('dry-run')
                    .setDescription('Set to "False" to execute. (Default: True)')
                    .setAutocomplete(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        const choices = ['True', 'False'];
        if (focusedOption.name === 'mass' || focusedOption.name === 'dry-run') {
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

        const currentRole = interaction.options.getRole('current-role', true) as Role;
        const desiredRole1 = interaction.options.getRole('desired-role-1', true) as Role;
        const desiredRole2 = interaction.options.getRole('desired-role-2', true) as Role;
        const user = interaction.options.getMember('user') as GuildMember | null;
        const massExtend = interaction.options.getString('mass') === 'True';
        const dryRun = interaction.options.getString('dry-run') !== 'False'; // Defaults to true

        if (!user && !massExtend) {
            return interaction.editReply({
                content: "Invalid command usage. You must either specify a 'user' to extend the role for, or set 'mass' to 'True' to extend it for everyone."
            });
        }

        const runIdentifier = `(Dry Run #${Date.now()})`;
        const executionIdentifier = `(Execution #${Date.now()})`;
        const identifier = dryRun ? runIdentifier : executionIdentifier;

        // Scenario 1: Single user specified
        if (user) {
            if (!user.roles.cache.has(currentRole.id)) {
                return interaction.editReply({ content: `${user.displayName} does not have the ${currentRole.name} role.` });
            }

            try {
                if (!dryRun) {
                    await user.roles.add(desiredRole1);
                    await user.roles.add(desiredRole2);
                }
                this.sendLog(interaction, currentRole, desiredRole1, desiredRole2, user, false, dryRun, identifier);
                return interaction.editReply({ content: `${identifier} Successfully extended the ${currentRole.name} role with ${desiredRole1.name} and ${desiredRole2.name} for ${user.displayName}.` });
            } catch (error) {
                this.client.logger.error({ message: `Failed to extend role for ${user.displayName}`, error });
                return interaction.editReply({ content: `${identifier} There was an error trying to extend the role. Please check my permissions and the role hierarchy.` });
            }
        }

        // Scenario 2: Mass extension
        if (massExtend) {
            try {
                await interaction.editReply({ content: `${identifier} Fetching members with the ${currentRole.name} role... This might take a while.` });

                await interaction.guild.members.fetch();

                const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(currentRole.id));

                if (membersWithRole.size === 0) {
                    return interaction.followUp({ content: `${identifier} No one has the ${currentRole.name} role.`, flags: MessageFlags.Ephemeral });
                }

                await interaction.followUp({ content: `${identifier} Found ${membersWithRole.size} members. Starting role extension...`, flags: MessageFlags.Ephemeral });

                let successCount = 0;
                let errorCount = 0;

                for (const member of membersWithRole.values()) {
                    try {
                        if (!dryRun) {
                            await member.roles.add(desiredRole1);
                            await member.roles.add(desiredRole2);
                        }
                        this.sendLog(interaction, currentRole, desiredRole1, desiredRole2, member, true, dryRun, identifier);
                        successCount++;
                    } catch {
                        errorCount++;
                    }
                }

                return interaction.followUp({ content: `${identifier} Mass extension complete. Extended the ${currentRole.name} role with ${desiredRole1.name} and ${desiredRole2.name} for ${successCount} members. Failed to extend for ${errorCount} members.`, flags: MessageFlags.Ephemeral });

            } catch (error) {
                this.client.logger.error({ message: `Failed mass role extension for role ${currentRole.name}`, error });
                return interaction.followUp({ content: `${identifier} An unexpected error occurred during mass extension.`, flags: MessageFlags.Ephemeral });
            }
        }
    }

    private async sendLog(interaction: ChatInputCommandInteraction, currentRole: Role, desiredRole1: Role, desiredRole2: Role, member: GuildMember, isMass: boolean, isDryRun: boolean, identifier: string) {
        try {
            const logChannel = await this.client.channels.fetch(LOG_CHANNEL_ID) as TextChannel;
            if (!logChannel) return;

            const dryRunText = isDryRun ? `[DRY RUN] ` : '';
            const massText = isMass ? ` in a mass extension` : '';

            const description = `${dryRunText}${identifier}\n${member.user} who has ${currentRole} was extended with ${desiredRole1} and ${desiredRole2} by ${interaction.user}${massText}.`;

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor(this.client.color)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error({ message: `Failed to send role extension log`, error });
        }
    }
}
