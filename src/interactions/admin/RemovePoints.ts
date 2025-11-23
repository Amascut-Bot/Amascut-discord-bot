import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User, MessageFlags } from 'discord.js';
import { HostParticipation } from '../../entity/HostParticipation';

export default class RemovePoints extends BotInteraction {
    get name() {
        return 'remove-points';
    }

    get description() {
        return 'Removes leaderboard points for a team (i.e. trial participation)';
    }

    get permissions() {
        return 'ADMIN';
    }

    get featureOptions() {
        const assignOptions: any = {
            'Trial Team': 'trial',
            'Lore Book Crew': 'lorebook',
            'Teacher': 'teacher',
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    get typeOptions() {
        const assignOptions: any = {
            'Host': 'host',
            'Participation': 'participation',
            'Both': 'both',
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('team').setDescription('Team').addChoices(
                ...this.featureOptions
            ).setRequired(true))
            .addStringOption((option) => option.setName('type').setDescription('Type').addChoices(
                ...this.typeOptions
            ).setRequired(true))
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
            .addIntegerOption((option) => option.setName('quantity').setDescription('Quantity of points').setRequired(true))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const team: string = interaction.options.getString('team', true);
        const type: string = interaction.options.getString('type', true);
        const user: User = interaction.options.getUser('user', true);
        const quantity: number = interaction.options.getInteger('quantity', true);

        const { dataSource } = this.client;
        const { colours } = this.client.util;

        // find hosts to remove points from
        const repository = dataSource.getRepository(HostParticipation);

        const hosts = await repository.find({
            where: {
                type: team === 'teacher' ? 0 : team === 'lorebook' ? 1 : team === 'trial' ? 2 : -1,
                host: type === 'host' || type === 'both' ? 1 : 0,
                participate: type === 'participation' || type === 'both' ? 1: 0,
                user: user.id
            },
            take: quantity
        });

        if (hosts.length >= quantity) {
            await repository.remove(hosts);

            const replyEmbed = new EmbedBuilder()
                .setTitle('Points successfully removed!')
                .setColor(colours.discord.green)
                .setDescription(`<@${user.id}> was successfully removed **${quantity}** points.`);
            await interaction.editReply({ embeds: [replyEmbed] });
        } else {
            const replyEmbed = new EmbedBuilder()
                .setTitle('Points can\'t be removed!')
                .setColor(colours.discord.red)
                .setDescription(`<@${user.id}> has not enough points to be removed.`);
            await interaction.editReply({ embeds: [replyEmbed] });
        }
    }
}
