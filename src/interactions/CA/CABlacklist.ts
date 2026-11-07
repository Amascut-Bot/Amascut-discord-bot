import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, User } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { CABlacklist as CABlacklistEntry } from '../../entity/CABlacklist';

export default class CABlacklist extends BotInteraction {
    get name() {
        return 'ca-blacklist';
    }

    get description() {
        return 'Manage users who cannot join Combat Achievement queues';
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
                    .setDescription('Blacklist a user from all CA queues')
                    .addUserOption(option =>
                        option.setName('user')
                            .setDescription('Server user to blacklist')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from the CA blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                            .setDescription('Server user to remove from the blacklist')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List everyone on the CA blacklist'));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        const action = interaction.options.getSubcommand();
        if (action !== 'add' && action !== 'remove') {
            if (action !== 'list') {
                throw new Error(`Unknown CA blacklist action: ${action}`);
            }
        }

        const repository = this.client.dataSource.getRepository(CABlacklistEntry);
        if (action === 'list') {
            const entries = await repository.find({
                where: { guildId: guild.id },
                order: { userId: 'ASC' },
            });
            if (entries.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(this.client.color)
                    .setTitle('CA Blacklist')
                    .setDescription('No users are currently on the CA blacklist.');
                return interaction.editReply({ embeds: [emptyEmbed] });
            }

            const chunks: string[] = [];
            let currentChunk = '';
            for (const entry of entries) {
                const addedBy = entry.addedBy ? `<@${entry.addedBy}>` : 'Unknown';
                const line = `<@${entry.userId}> — added by ${addedBy}`;
                if (currentChunk && currentChunk.length + line.length + 1 > 4000) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
            }
            if (currentChunk) {
                chunks.push(currentChunk);
            }

            const embeds = chunks.map((description, index) =>
                new EmbedBuilder()
                    .setColor(this.client.color)
                    .setTitle(`CA Blacklist (${entries.length} users)`)
                    .setDescription(description)
                    .setFooter({ text: `Page ${index + 1} of ${chunks.length}` }),
            );
            for (let index = 0; index < embeds.length; index += 10) {
                const page = embeds.slice(index, index + 10);
                if (index === 0) {
                    await interaction.editReply({ embeds: page, allowedMentions: { parse: [] } });
                } else {
                    await interaction.followUp({ embeds: page, allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
                }
            }
            return;
        }

        const user: User = interaction.options.getUser('user', true);
        const existingEntry = await repository.findOneBy({ guildId: guild.id, userId: user.id });

        if (action === 'add') {
            if (existingEntry) {
                return interaction.editReply(`<@${user.id}> is already on the CA blacklist.`);
            }

            await repository.save(repository.create({
                guildId: guild.id,
                userId: user.id,
                addedBy: interaction.user.id,
            }));
            this.client.logger.log({
                handler: this.constructor.name,
                user: `${interaction.user.username} | ${interaction.user.id}`,
                message: `Added ${user.username} (${user.id}) to the CA blacklist.`,
            }, true);
            return interaction.editReply(`<@${user.id}> has been added to the CA blacklist and cannot join any CA queue.`);
        }

        if (!existingEntry) {
            return interaction.editReply(`<@${user.id}> is not on the CA blacklist.`);
        }

        await repository.remove(existingEntry);
        this.client.logger.log({
            handler: this.constructor.name,
            user: `${interaction.user.username} | ${interaction.user.id}`,
            message: `Removed ${user.username} (${user.id}) from the CA blacklist.`,
        }, true);
        return interaction.editReply(`<@${user.id}> has been removed from the CA blacklist.`);
    }
}
