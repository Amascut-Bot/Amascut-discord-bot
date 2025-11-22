import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandStringOption, MessageFlags } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';

export default class Query extends BotInteraction {
    get name() {
        return 'query';
    }

    get description() {
        return 'Send a database query to the db';
    }

    get permissions() {
        return 'BOT_OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option: SlashCommandStringOption) => option.setName('query').setDescription('Query to execute.').setRequired(true));
    }

    static trim(string: string, max: number): string {
        return string.length > max ? string.slice(0, max) : string;
    }

    async run(interaction: ChatInputCommandInteraction<any>) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const query = interaction.options.getString('query', true);

        if (interaction.channel && 'send' in interaction.channel) {
            let result = await this.client.dataSource.query(query);
            result = JSON.stringify(result, null, 2);

            this.client.logger.log({
                message: `${interaction.user.id} (${interaction.user.displayName}) executed the following query: '${query}'`
            }, true);

            for (let i = 0; i < result.length; i += 1950) {
                await interaction.followUp({
                    content: `\`\`\`json\n${result.slice(i, i + 1950)}\n\`\`\``,
                    flags: MessageFlags.Ephemeral
                });
            }
            return;
        }

        return await interaction.editReply('Command needs to be executed in a textbased channel');
    }
}
