import { ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import CAQueueHandler from '../../modules/CAQueueHandler';
import { CAQueueType } from '../../entity/CAQueue';

export default class CAQueueRemove extends BotInteraction {
    get name() {
        return 'ca-queue-remove';
    }

    get description() {
        return 'Remove a user from a Combat Achievement queue';
    }

    get permissions() {
        return 'CAHELPER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('The queue to manage')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Unorthodox', value: 'uo' },
                        { name: '4K', value: '4k' },
                        { name: 'Perfect', value: 'perf' },
                    ))
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Server user to remove')
                    .setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const selectedQueueType = interaction.options.getString('type', true);
        if (selectedQueueType !== 'uo' && selectedQueueType !== '4k' && selectedQueueType !== 'perf') {
            throw new Error(`Unknown CA queue type: ${selectedQueueType}`);
        }
        const queueType: CAQueueType = selectedQueueType;
        const user: User = interaction.options.getUser('user', true);
        this.client.logger.log({
            handler: this.constructor.name,
            user: `${interaction.user.username} | ${interaction.user.id}`,
            message: `CA queue options: action=remove, type=${queueType}, user=${user.username} (${user.id})`,
        }, true);

        return CAQueueHandler.manageQueue(this.client, interaction, 'remove', queueType, user);
    }
}
