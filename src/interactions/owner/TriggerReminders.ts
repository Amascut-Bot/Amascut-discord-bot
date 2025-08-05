import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default class TriggerReminders extends BotInteraction {
    get name() {
        return 'trigger-reminders';
    }

    get description() {
        return 'Manually trigger the voice channel reminders (Owner only)';
    }

    get permissions() {
        return 'OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const { colours } = this.client.util;

        try {
            await this.client.reminderHandler.triggerReminders();
            
            const embed = new EmbedBuilder()
                .setTitle('Reminders Triggered')
                .setDescription('Successfully triggered voice channel reminders in all target channels.')
                .setColor(colours.discord.green);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('Failed to trigger reminders. Check logs for details.')
                .setColor(colours.discord.red);

            await interaction.editReply({ embeds: [embed] });
        }
    }
}