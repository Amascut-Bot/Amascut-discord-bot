import { ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import CAQueueHandler from '../../modules/CAQueueHandler';
import { CAQueueType } from '../../entity/CAQueue';

export default class CAQueueMove extends BotInteraction {
    get name() {
        return 'ca-queue-move';
    }

    get description() {
        return 'Move a user to a different Combat Achievement queue position';
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
                        { name: 'GM Timer', value: 'gmtimer' },
                    ))
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Server user to move')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('position')
                    .setDescription('New queue position')
                    .setMinValue(1)
                    .setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const selectedQueueType = interaction.options.getString('type', true);
        if (selectedQueueType !== 'uo' && selectedQueueType !== '4k' && selectedQueueType !== 'perf' && selectedQueueType !== 'gmtimer') {
            throw new Error(`Unknown CA queue type: ${selectedQueueType}`);
        }
        const queueType: CAQueueType = selectedQueueType;
        const user: User = interaction.options.getUser('user', true);
        const position = interaction.options.getInteger('position', true);
        this.client.logger.log({
            handler: this.constructor.name,
            user: `${interaction.user.username} | ${interaction.user.id}`,
            message: `CA queue options: action=move, type=${queueType}, user=${user.username} (${user.id}), position=${position}`,
        }, true);

        return CAQueueHandler.manageQueue(this.client, interaction, 'move', queueType, user, position);
    }
}
