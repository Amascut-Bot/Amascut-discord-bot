import BotInteraction from '../../types/BotInteraction';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Role, SlashCommandBuilder, TextChannel } from 'discord.js';

export default class Say extends BotInteraction {
    get name() {
        return 'dpm-submit';
    }

    get description() {
        return 'Submit for a DPM role! To check what role you qualify for, try using /dpm to calculate your DPM';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('time').setDescription('The time of your kill in the format MM:SS. Ticks are supported, i.e. 1:23.4').setRequired(true))
            .addStringOption((option) => option.setName('damage').setDescription('The full amount of damage you did, i.e. for 100k damage, use 100000').setRequired(true))
            .addStringOption((option) => option.setName('first_screenshot').setDescription('Your first screenshot').setRequired(true))
            .addStringOption((option) => option.setName('second_screenshot').setDescription('Your second screenshot').setRequired(true))
    }

    public getRole = async (interaction: ChatInputCommandInteraction, damage: number) => {
        let roleToAssign;
        const { stripRole, roles } = this.client.util;
        const { initiate, adept, mastery, extreme } = this.client.util.dpm
        if (damage >= extreme) {
            roleToAssign = 'extreme';
        } else if (damage >= mastery) {
            roleToAssign = 'mastery';
        } else if (damage >= adept) {
            roleToAssign = 'adept'
        } else if (damage >= initiate) {
            roleToAssign = 'initiate'
        }

        if (!roleToAssign) return;

        const role = await interaction.guild?.roles.fetch(stripRole(roles[roleToAssign])) as Role;

        return role;
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const time: string = interaction.options.getString('time', true);
        const damage: string = interaction.options.getString('damage', true);
        const firstScreenshot: string = interaction.options.getString('first_screenshot', true);
        const secondScreenshot: string = interaction.options.getString('second_screenshot', true);

        const { colours, channels, roles, dpm, calcDPMInThousands, isValidDamage, isValidTime } = this.client.util;

        const errorEmbed = new EmbedBuilder()
            .setColor(colours.discord.red)
            .setDescription(`
            ${!isValidTime(time) ? 'Your **time** was not formatted correctly.' : ''}
            ${!isValidDamage(damage) ? 'Your **damage** was not formatted correctly.' : ''}
            `);

        if (!isValidTime(time) || !isValidDamage(damage)) return await interaction.editReply({ embeds: [errorEmbed] });

        const calcedDPM = calcDPMInThousands(damage, time);

        errorEmbed.setDescription(`At \`${calcedDPM}k\` DPM, you do not qualify for any roles.`);

        if (calcedDPM < dpm.initiate) return await interaction.editReply({ embeds: [errorEmbed] });

        const role = await this.getRole(interaction, calcedDPM);

        const submissionEmbed = new EmbedBuilder()
            .setColor(role ? role.color : colours.lightblue)
            .setDescription(`
            **Submitter:** <@${interaction.user.id}>
            **Damage:** \`${(+damage).toLocaleString()}\`
            **Time:** \`${time}\`
            **DPM:** \`${calcedDPM}k\`
            ${role ? `\n> This DPM qualifies for the <@&${role.id}> role.` : ''}
            `);

        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('approveDPM')
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('rejectDPM')
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger),
            );

        const channel = await this.client.channels.fetch(channels.botRoleLog) as TextChannel;
        await channel.send({
            content: `> **Submission by <@${interaction.user.id}> for <@&${role?.id}>**\n**First Screenshot:** ${firstScreenshot}\n**Second Screenshot:** ${secondScreenshot}`,
            allowedMentions: {
                users: [],
                roles: []
            }
        });
        await channel.send({ embeds: [submissionEmbed], components: [buttonRow] });
        const successEmbed = new EmbedBuilder()
            .setTitle('Your DPM submission has been received!')
            .setColor(colours.discord.green)
            .setDescription(`An ${roles.admin} will review your submission and handle it shortly.`);
        return await interaction.editReply({ embeds: [successEmbed] });
    }
}
