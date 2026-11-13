import { ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import CAQueueHandler from '../../modules/CAQueueHandler';
import { CAQueueType } from '../../entity/CAQueue';

export default class CAQueueAdd extends BotInteraction {
    get name() {
        return 'ca-queue-add';
    }

    get description() {
        return 'Add a user to a Combat Achievement queue';
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
                    .setDescription('Server user to add')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('position')
                    .setDescription('Queue position (defaults to the end)')
                    .setMinValue(1)
                    .setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const selectedQueueType = interaction.options.getString('type', true);
        if (selectedQueueType !== 'uo' && selectedQueueType !== '4k' && selectedQueueType !== 'perf' && selectedQueueType !== 'gmtimer') {
            throw new Error(`Unknown CA queue type: ${selectedQueueType}`);
        }
        const queueType: CAQueueType = selectedQueueType;
        const user: User = interaction.options.getUser('user', true);
        const position = interaction.options.getInteger('position') ?? undefined;
        this.client.logger.log({
            handler: this.constructor.name,
            user: `${interaction.user.username} | ${interaction.user.id}`,
            message: `CA queue options: action=add, type=${queueType}, user=${user.username} (${user.id}), position=${position ?? 'end (default)'}`,
        }, true);

        return CAQueueHandler.manageQueue(this.client, interaction, 'add', queueType, user, position);
    }
}
