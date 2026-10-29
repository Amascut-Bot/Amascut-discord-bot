import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, DiscordAPIError, EmbedBuilder, MessageFlags, TextChannel } from 'discord.js';
import Bot from '../Bot';
import { CAQueue, CAQueueType } from '../entity/CAQueue';

export default class CAQueueHandler {
    static readonly legacyButtonId = 'caqueue:signup';

    static buttonId(queueType: CAQueueType) {
        return `caqueue:${queueType}:signup`;
    }

    static isQueueButton(id: string) {
        return id === CAQueueHandler.legacyButtonId || /^caqueue:(uo|4k|perf):signup$/.test(id);
    }

    static createEmbed(queue: CAQueue) {
        const displayedSignups = queue.signups.slice(0, 100);
        const emptyQueueMessage = queue.enabled
            ? 'No one has joined the queue yet.'
            : CAQueueHandler.getClosedMessage(queue.queueType);
        const signups = displayedSignups.length
            ? displayedSignups.map((userId, index) => `${index + 1}. <@${userId}>`).join('\n')
            : emptyQueueMessage;
        const remainingSignups = queue.signups.length - displayedSignups.length;
        const queueName = CAQueueHandler.getQueueName(queue.queueType);

        return new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(`${queueName} Queue`)
            .setDescription(`**Status:** ${queue.enabled ? 'Open' : 'Closed'}\n**Queue (${queue.signups.length}):**\n${signups}${remainingSignups ? `\n...and ${remainingSignups} more.` : ''}`);
    }

    static createButtonRow(enabled: boolean, queueType: CAQueueType) {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(CAQueueHandler.buttonId(queueType))
                .setLabel(`Join ${CAQueueHandler.getQueueButtonName(queueType)} queue`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!enabled),
        );
    }

    static async startQueue(client: Bot, interaction: ChatInputCommandInteraction, queueType: CAQueueType) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        const channelId = client.channelIds.casignup;
        if (!channelId) {
            return interaction.editReply('The CA signup channel is not configured for this server.');
        }

        const channel = await guild.channels.fetch(channelId);
        if (!(channel instanceof TextChannel)) {
            return interaction.editReply('The configured CA signup channel is not a text channel.');
        }

        const repository = client.dataSource.getRepository(CAQueue);
        let queue = await repository.findOneBy({ guildId: guild.id, queueType });
        if (queue?.enabled) {
            await CAQueueHandler.updateBoard(client, queue);
            return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue is already enabled.`);
        }

        if (queue) {
            queue.enabled = true;
            queue.channelId = channel.id;
            await CAQueueHandler.updateBoard(client, queue);
            await repository.save(queue);
        } else {
            queue = repository.create({
                guildId: guild.id,
                queueType,
                channelId: channel.id,
                messageId: null,
                signups: [],
                enabled: true,
            });
            const board = await channel.send({
                embeds: [CAQueueHandler.createEmbed(queue)],
                components: [CAQueueHandler.createButtonRow(true, queueType)],
                allowedMentions: { parse: [] },
            });
            queue.messageId = board.id;
            await repository.save(queue);
        }

        return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue is now enabled.`);
    }

    static async stopQueue(client: Bot, interaction: ChatInputCommandInteraction, queueType: CAQueueType) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        const repository = client.dataSource.getRepository(CAQueue);
        const queue = await repository.findOneBy({ guildId: guild.id, queueType });
        if (!queue) {
            return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue is not enabled.`);
        }

        queue.enabled = false;
        queue.signups = [];
        await repository.save(queue);
        await CAQueueHandler.updateBoard(client, queue);

        return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue is now disabled and cleared.`);
    }

    static async wipeQueue(client: Bot, interaction: ChatInputCommandInteraction, queueType: CAQueueType) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        const repository = client.dataSource.getRepository(CAQueue);
        const queue = await repository.findOneBy({ guildId: guild.id, queueType });
        if (!queue) {
            return interaction.editReply(`There is no ${CAQueueHandler.getQueueName(queueType)} queue to clear.`);
        }

        queue.signups = [];
        await repository.save(queue);
        await CAQueueHandler.updateBoard(client, queue);

        return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue has been cleared.`);
    }

    static async nextInQueue(client: Bot, interaction: ChatInputCommandInteraction, queueType: CAQueueType) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        const repository = client.dataSource.getRepository(CAQueue);
        const queue = await repository.findOneBy({ guildId: guild.id, queueType });
        if (!queue || queue.signups.length === 0) {
            return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue is empty.`);
        }

        const removedUserId = queue.signups.shift();
        if (!removedUserId) {
            return interaction.editReply(`The ${CAQueueHandler.getQueueName(queueType)} queue is empty.`);
        }
        const nextUserId = queue.signups[0];
        await repository.save(queue);
        await CAQueueHandler.updateBoard(client, queue);

        const nextMessage = nextUserId ? `Next in queue: <@${nextUserId}>.` : 'There is no one left in the queue.';
        return interaction.editReply(`Removed <@${removedUserId}> from the ${CAQueueHandler.getQueueName(queueType)} queue. ${nextMessage}`);
    }

    static async updateBoard(client: Bot, queue: CAQueue) {
        if (!queue.messageId) {
            throw new Error(`CA queue for guild ${queue.guildId} does not have a board message.`);
        }

        const channelId = client.channelIds.casignup;
        if (!channelId) {
            throw new Error('The CA signup channel is not configured.');
        }

        const guild = await client.guilds.fetch(queue.guildId);
        const channel = await guild.channels.fetch(channelId);
        if (!(channel instanceof TextChannel)) {
            throw new Error(`Configured CA signup channel ${channelId} is not a text channel in guild ${queue.guildId}.`);
        }
        queue.channelId = channel.id;

        try {
            const message = await channel.messages.fetch(queue.messageId);
            await message.edit({
                embeds: [CAQueueHandler.createEmbed(queue)],
                components: [CAQueueHandler.createButtonRow(queue.enabled, queue.queueType)],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            if (!(error instanceof DiscordAPIError) || error.code !== 10008) {
                throw error;
            }

            const replacement = await channel.send({
                embeds: [CAQueueHandler.createEmbed(queue)],
                components: [CAQueueHandler.createButtonRow(queue.enabled, queue.queueType)],
                allowedMentions: { parse: [] },
            });
            queue.messageId = replacement.id;
            await client.dataSource.getRepository(CAQueue).save(queue);
        }
    }

    static async handleSignup(client: Bot, id: string, interaction: ButtonInteraction<'cached'>) {
        const queueType = id === CAQueueHandler.legacyButtonId
            ? 'uo'
            : id.split(':')[1] as CAQueueType;
        const repository = client.dataSource.getRepository(CAQueue);
        const queue = await repository.findOneBy({ guildId: interaction.guildId, queueType });
        const queueName = CAQueueHandler.getQueueName(queueType);
        if (!queue || !queue.enabled) {
            return interaction.reply({
                content: `The ${queueName} queue is currently closed.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const signupIndex = queue.signups.indexOf(interaction.user.id);
        const joined = signupIndex === -1;
        if (joined) {
            queue.signups.push(interaction.user.id);
        } else {
            queue.signups.splice(signupIndex, 1);
        }

        await repository.save(queue);
        await interaction.update({
            embeds: [CAQueueHandler.createEmbed(queue)],
            components: [CAQueueHandler.createButtonRow(queue.enabled, queueType)],
            allowedMentions: { parse: [] },
        });
        return interaction.followUp({
            content: joined
                ? `You joined the ${queueName} queue.`
                : `You left the ${queueName} queue.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    private static getQueueButtonName(queueType: CAQueueType) {
        switch (queueType) {
            case 'uo':
                return 'UO';
            case '4k':
                return '4K';
            case 'perf':
                return 'Perfect';
        }
    }

    private static getQueueName(queueType: CAQueueType) {
        switch (queueType) {
            case 'uo':
                return 'Unorthodox';
            case '4k':
                return '4K';
            case 'perf':
                return 'Perfect';
        }
    }

    private static getClosedMessage(queueType: CAQueueType) {
        switch (queueType) {
            case 'uo':
                return 'Unorthodox Combat Achievement is not currently being hosted';
            case '4k':
                return '4K Combat Achievement is not currently being hosted';
            case 'perf':
                return 'Perfect Combat Achievement is not currently being hosted';
        }
    }
}
