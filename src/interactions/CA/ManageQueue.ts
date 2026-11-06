import { ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import CAQueueHandler from '../../modules/CAQueueHandler';
import { CAQueueType } from '../../entity/CAQueue';

export default class ManageQueue extends BotInteraction {
    get name() {
        return 'ca-queue';
    }

    get description() {
        return 'Add, remove, or move users in a Combat Achievement queue';
    }

    get permissions() {
        return 'CAHELPER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a user to a queue')
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
                            .setDescription('Server user to add')
                            .setRequired(true))
                    .addIntegerOption(option =>
                        option.setName('position')
                            .setDescription('Queue position (defaults to the end)')
                            .setMinValue(1)
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from a queue')
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
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('move')
                    .setDescription('Move a user to a different queue position')
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
                            .setDescription('Server user to move')
                            .setRequired(true))
                    .addIntegerOption(option =>
                        option.setName('position')
                            .setDescription('New queue position')
                            .setMinValue(1)
                            .setRequired(true)));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== 'add' && subcommand !== 'remove' && subcommand !== 'move') {
            throw new Error(`Unknown CA queue management action: ${subcommand}`);
        }

        const selectedQueueType = interaction.options.getString('type', true);
        const queueTypes: Record<string, CAQueueType> = {
            uo: 'uo',
            '4k': '4k',
            perf: 'perf',
        };
        const queueType = queueTypes[selectedQueueType];
        if (!queueType) {
            throw new Error(`Unknown CA queue type: ${selectedQueueType}`);
        }

        const user: User = interaction.options.getUser('user', true);
        const position = interaction.options.getInteger('position') ?? undefined;
        this.client.logger.log({
            handler: this.constructor.name,
            user: `${interaction.user.username} | ${interaction.user.id}`,
            message: `CA queue options: action=${subcommand}, type=${queueType}, user=${user.username} (${user.id}), position=${position ?? (subcommand === 'add' ? 'end (default)' : 'not applicable')}`,
        }, true);

        return CAQueueHandler.manageQueue(this.client, interaction, subcommand, queueType, user, position);
    }
}
