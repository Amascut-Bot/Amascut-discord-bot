import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import { getRoles } from "../../GuildSpecifics";

export default class DpmThresholds extends BotInteraction {
    get name() {
        return 'dpm-thresholds';
    }

    get description() {
        return 'Manage DPM role thresholds (Moderator+ only)';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addIntegerOption(option =>
                option
                    .setName('adept')
                    .setDescription('Adept DPM threshold (in thousands)')
                    .setRequired(false)
                    .setMinValue(1)
            )
            .addIntegerOption(option =>
                option
                    .setName('mastery')
                    .setDescription('Mastery DPM threshold (in thousands)')
                    .setRequired(false)
                    .setMinValue(1)
            )
            .addIntegerOption(option =>
                option
                    .setName('extreme')
                    .setDescription('Extreme DPM threshold (in thousands)')
                    .setRequired(false)
                    .setMinValue(1)
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        // Check permissions
        const hasPermissions = await this.client.util.hasRolePermissions(
            this.client,
            ['moderator', 'admin', 'owner'],
            interaction
        );

        if (!hasPermissions) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        try {
            await this.handleSet(interaction);
        } catch (error) {
            this.client.logger.error({
                message: 'Error in DpmThresholds command',
                error,
                handler: this.constructor.name
            });

            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    content: `❌ **Error:** ${errorMessage}`
                });
            } else {
                await interaction.reply({
                    content: `❌ **Error:** ${errorMessage}`,
                    ephemeral: true
                });
            }
        }
    }

    private async handleSet(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const currentThresholds = await this.client.util.getDpm();

        // Get new values from options, or keep current values
        const newThresholds = {
            adept: interaction.options.getInteger('adept') ?? currentThresholds.adept,
            mastery: interaction.options.getInteger('mastery') ?? currentThresholds.mastery,
            extreme: interaction.options.getInteger('extreme') ?? currentThresholds.extreme
        };

        // Check if any values were actually provided
        const providedOptions = ['adept', 'mastery', 'extreme']
            .filter(option => interaction.options.getInteger(option) !== null);

        if (providedOptions.length === 0) {
            await interaction.editReply({
                content: '❌ **Error:** You must provide at least one threshold value to update.'
            });
            return;
        }

        try {
            // Update the thresholds
            await this.client.util.updateDpmThresholds(newThresholds, interaction.user.id);
        } catch (error) {
            // Provide more helpful error message with current values
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
            const currentValues = `\n\n**Current thresholds:**\n• Adept: ${currentThresholds.adept}k\n• Mastery: ${currentThresholds.mastery}k\n• Extreme: ${currentThresholds.extreme}k\n\n**Your values:**\n• Adept: ${newThresholds.adept}k\n• Mastery: ${newThresholds.mastery}k\n• Extreme: ${newThresholds.extreme}k\n\n**Remember:** Adept < Mastery < Extreme`;

            await interaction.editReply({
                content: `❌ **Error:** ${errorMessage}${currentValues}`
            });
            return;
        }

        const { colours } = this.client.util;

        const descriptionLines = providedOptions.map(key => {
            const roleMention = getRoles(interaction.guild?.id)[key];
            const newValue = newThresholds[key as keyof typeof newThresholds];
            return `${roleMention} threshold has successfully updated to **${newValue}k DPM**.`;
        });

        const embed = new EmbedBuilder()
            .setColor(colours.discord.green)
            .setDescription(descriptionLines.join('\n'));

        await interaction.editReply({ embeds: [embed] });

        // Log the change
        this.client.logger.log({
            message: `DPM thresholds updated by ${interaction.user.username} (${interaction.user.id}). Changed: ${providedOptions.join(', ')}`,
            handler: this.constructor.name
        }, true);
    }
}
