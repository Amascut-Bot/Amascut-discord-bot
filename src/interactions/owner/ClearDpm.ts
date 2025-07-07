import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { DpmSubmission } from '../../entity/DpmSubmission';

export default class ClearDpm extends BotInteraction {
    get name() {
        return 'dpm-clear';
    }

    get description() {
        return 'Clears all DPM submissions from the database. (Owner only)';
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

        const dpmSubmissionRepository = this.client.dataSource.getRepository(DpmSubmission);
        
        try {
            await dpmSubmissionRepository.clear();
            await interaction.editReply({ content: 'All DPM submissions have been successfully cleared from the database.' });
        } catch (error) {
            this.client.logger.error({
                message: 'Failed to clear DPM submissions.',
                error,
                handler: this.constructor.name,
            });
            await interaction.editReply({ content: 'An error occurred while trying to clear the DPM submissions.' });
        }
    }
} 