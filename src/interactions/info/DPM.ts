import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, EmbedBuilder, Role, SlashCommandBuilder, TextChannel } from 'discord.js';

export default class Say extends BotInteraction {
    get name() {
        return 'dpm';
    }

    get description() {
        return 'Calculate your DPM and see what roles you qualify for!';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('time').setDescription('The time of your kill in the format MM:SS. Ticks are supported, i.e. 1:23.4').setRequired(true))
            .addStringOption((option) => option.setName('damage').setDescription('The full amount of damage you did, i.e. for 100k damage, use 100000').setRequired(true))
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

        const { colours, channels, calcDPMInThousands, isValidDamage, isValidTime } = this.client.util;

        const errorEmbed = new EmbedBuilder()
            .setColor(colours.discord.red)
            .setDescription(`
            ${!isValidTime(time) ? 'Your **time** was not formatted correctly.' : ''}
            ${!isValidDamage(damage) ? 'Your **damage** was not formatted correctly.' : ''}
            `);

        if (!isValidTime(time) || !isValidDamage(damage)) return await interaction.editReply({ embeds: [errorEmbed] });

        const dpm = calcDPMInThousands(damage, time);

        const role = await this.getRole(interaction, dpm);

        const DPMEmbed = new EmbedBuilder()
            .setColor(role ? role.color : colours.lightblue)
            .setDescription(`
            **Submitter:** <@${interaction.user.id}>
            **Damage:** \`${(+damage).toLocaleString()}\`
            **Time:** \`${time}\`
            **DPM:** \`${dpm}k\`
            ${role ? `\n> This DPM qualifies for the <@&${role.id}> role!` : ''}
            `);

        const channel = await this.client.channels.fetch(channels.dpmCalc) as TextChannel;
        await channel.send({ embeds: [DPMEmbed] });
        const successEmbed = new EmbedBuilder()
            .setColor(colours.discord.green)
            .setDescription(`
            DPM successfully calculated!
            ${role ? `\n> To apply for <@&${role.id}> use \`/dpm-submit\`` : ''}
            `);
        return await interaction.editReply({ embeds: [successEmbed] });
    }
}
