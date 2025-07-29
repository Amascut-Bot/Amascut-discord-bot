import { getChannels, getRoles } from '../../GuildSpecifics';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Message, ButtonBuilder, ActionRowBuilder, ButtonStyle, TextChannel } from 'discord.js';

interface EmbedContent {
    [key: string]: string;
}

export default class StartReaper extends BotInteraction {
    get name() {
        return 'start-reaper';
    }

    get description() {
        return 'Starts a Reaper card from within a reaper ticket.';
    }

    get permissions() {
        return 'REAPER';
    }

    get regionOptions() {
        const assignOptions: any = {
            'North America (East)': 'NA East',
            'North America (West)': 'NA West',
            'Europe': 'Europe',
            'Oceania': 'Oceania'
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
            .addStringOption((option) => option.setName('region').setDescription('Reaper world').addChoices(
                ...this.regionOptions
            ).setRequired(true))
    }

    public ticketToolEmbedContent = async (interaction: ChatInputCommandInteraction) => {

        const content: EmbedContent = {
            rsn: '',
            id: '',
        }

        const cleanValueFromDescription = (description: string, pattern: RegExp, index: number, key: string) => {
            const regex = description ? description.match(pattern) : [];
            const dirty = regex ? regex[0] : '';
            const stripped = dirty.replace(/\s+/g, '');
            content[key] = stripped.slice(index, -3);
        }

        try {
            const messages = await interaction.channel?.messages.fetchPinned();
            if (!messages) return;
            // Get correct message
            let message: Message | null = null;
            for (const [_id, item] of messages) {
                if (item.author.bot === true) {
                    message = item;
                    break;
                }
            }
            if (!message) return;
            const description = message.embeds[0].description || '';
            if (!description) return;
            // RSN
            cleanValueFromDescription(description, /\*{2}RSN\*{2}\n```.+/gm, 10, 'rsn');
            // Discord ID
            cleanValueFromDescription(description, /\*{2}Discord ID\*{2}\n```.+/gm, 16, 'id');
        } catch {
            return content
        }
        return content
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const region: string = interaction.options.getString('region', true);

        const { colours } = this.client.util;

        const info = await this.ticketToolEmbedContent(interaction);

        let errorMessage = '';

        if (!info) {
            errorMessage += 'There was an issue with grabbing **Ticket Tool** data. Please check if the message is pinned.'
        }

        const errorEmbed = new EmbedBuilder()
            .setTitle('Something went wrong!')
            .setColor(colours.discord.red)
            .setDescription(errorMessage || 'No error message.');
        if (!info) return await interaction.editReply({ embeds: [errorEmbed] });

        const groupButtonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('selectBase')
                    .setLabel('Base')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('selectOutside')
                    .setLabel('Outside')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('selectElf')
                    .setLabel('Elf')
                    .setStyle(ButtonStyle.Secondary)
            );

        const controlPanel = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('startReaper')
                    .setLabel('Start Reaper')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('disbandReaper')
                    .setLabel('Disband')
                    .setStyle(ButtonStyle.Danger)
            );

        const fields = [
            { name: 'Base', value: '`Empty`', inline: true },
            { name: 'Outside', value: `<@${info.id}> (Reaper)`, inline: true },
            { name: 'Outside', value: '`Empty`', inline: true },
            { name: 'Elf', value: '`Empty`', inline: true },
            { name: 'Elf', value: '`Empty`', inline: true },
        ]
        const cardEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setColor(colours.tan)
            .setDescription(`
            > **General**\n
            \`Host:\` <@${interaction.user.id}>
            \`Time:\` \`ASAP\`
            \`Region:\` ${region}
            \`Ticket:\` <#${interaction.channel?.id}>\n
            > **Recipient**\n
            \`RSN:\` ${info.rsn}
            \`Discord:\` <@${info.id}>\n
            > **Team**
            `)
            .addFields(fields);

        const channel = await this.client.channels.fetch(getChannels(interaction.guild?.id).reaperScheduling) as TextChannel;
        await channel.send(
            { content: `${getRoles(interaction.guild?.id)['reaper']}`, embeds: [cardEmbed], components: [groupButtonRow, controlPanel] }
        )

        const replyEmbed = new EmbedBuilder()
            .setTitle('Reaper card created!')
            .setColor(colours.discord.green)
            .setDescription(`${getRoles(interaction.guild?.id)['reaper']} has been notified in <#${getChannels(interaction.guild?.id).reaperScheduling}>`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}
