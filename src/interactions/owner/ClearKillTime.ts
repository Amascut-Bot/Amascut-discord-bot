import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { KillTimeSubmission } from '../../entity/KillTimeSubmission';

export default class ClearKillTime extends BotInteraction {
    get name() {
        return 'killtime-clear';
    }

    get description() {
        return 'Clears all kill time submissions from the database. (Owner only)';
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

        const killTimeSubmissionRepository = this.client.dataSource.getRepository(KillTimeSubmission);

        try {
            await killTimeSubmissionRepository.clear();
            await interaction.editReply({ content: 'All kill time submissions have been successfully cleared from the database.' });
        } catch (error) {
            this.client.logger.error({
                message: 'Failed to clear kill time submissions.',
                error,
                handler: this.constructor.name,
            });
            await interaction.editReply({ content: 'An error occurred while trying to clear the kill time submissions.' });
        }
    }
}
