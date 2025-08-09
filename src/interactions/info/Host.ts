import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize, SectionBuilder } from 'discord.js';

export default class Host extends BotInteraction {
    get name() {
        return 'host';
    }

    get description() {
        return 'Set up a Host Card';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('message').setDescription('Add a Message').setRequired(false))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const message: string | null = interaction.options.getString('message', false);

        const { colours, emojis } = this.client.util;

        const container = new ContainerBuilder();
        container.setAccentColor(this.client.color);

        if (message) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(message));
            container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
        }

        const baseInfo = new TextDisplayBuilder().setContent(
            [
                '**Base:**',
                '`Empty`'
            ].join('\n')
        );

        const baseButton = new ButtonBuilder()
            .setCustomId('host_selectBase')
            .setLabel('Base')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Primary);

        const baseSection = new SectionBuilder().addTextDisplayComponents(baseInfo).setButtonAccessory(baseButton);

        container.addSectionComponents(baseSection);
        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

        const role11Info = new TextDisplayBuilder().setContent(
            [
                '**Role 1:**',
                '`Empty`'
            ].join('\n')
        );

        const role11Button = new ButtonBuilder()
            .setCustomId('host_select11')
            .setLabel('Role 1')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Secondary);

        const role11Section = new SectionBuilder().addTextDisplayComponents(role11Info).setButtonAccessory(role11Button);

        container.addSectionComponents(role11Section);
        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

        const role12Info = new TextDisplayBuilder().setContent(
            [
                '**Role 1:**',
                '`Empty`'
            ].join('\n')
        );

        const role12Button = new ButtonBuilder()
            .setCustomId('host_select12')
            .setLabel('Role 1')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Secondary);

        const role12Section = new SectionBuilder().addTextDisplayComponents(role12Info).setButtonAccessory(role12Button);

        container.addSectionComponents(role12Section);
        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

        const role21Info = new TextDisplayBuilder().setContent(
            [
                '**Role 2:**',
                '`Empty`'
            ].join('\n')
        );

        const role21Button = new ButtonBuilder()
            .setCustomId('host_select21')
            .setLabel('Role 2')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Secondary);

        const role21Section = new SectionBuilder().addTextDisplayComponents(role21Info).setButtonAccessory(role21Button);

        container.addSectionComponents(role21Section);
        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

        const role22Info = new TextDisplayBuilder().setContent(
            [
                '**Role 2:**',
                '`Empty`'
            ].join('\n')
        );

        const role22Button = new ButtonBuilder()
            .setCustomId('host_select22')
            .setLabel('Role 2')
            .setEmoji('⚔️')
            .setStyle(ButtonStyle.Secondary);

        const role22Section = new SectionBuilder().addTextDisplayComponents(role22Info).setButtonAccessory(role22Button);

        container.addSectionComponents(role22Section);

        const channel = interaction.channel as TextChannel;
        await channel.send(
            { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } }
        );

        const replyEmbed = new EmbedBuilder()
            .setTitle('Host card created!')
            .setColor(colours.discord.green)
            .setDescription(`Host card has been posted`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}
