import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface DropTableItem {
    name: string;
    quantity: number;
    rarity: number;
    isUnique: boolean;
}

interface BossRevenueData {
    regularGpPerKill: number;
    overallGpPerKill: number;
    killsPerHour: number;
    regularGpPerHour: number;
    overallGpPerHour: number;
    calculationTime: string;
}

interface CachedRevenueData extends BossRevenueData {
    cachedAt: number;
}

interface TrackedEmbed {
    messageId: string;
    channelId: string;
    guildId: string;
    postedAt: number;
}

interface BossConfig {
    kph: number;
    lastUpdated?: string;
    notes?: string;
    trackedEmbeds?: TrackedEmbed[];
}

export default class BossRevenue extends BotInteraction {
    private static cache: CachedRevenueData | null = null;
    private static readonly CACHE_TTL = 7 * 60 * 1000;

    get name() {
        return 'boss-revenue';
    }

    get description() {
        return 'Calculate GP per kill and GP per hour for Raksha based on current prices';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral});
        const { colours } = this.client.util;

        try {
            const revenueData = await this.getCachedOrFreshData();

            const embed = new EmbedBuilder()
                .setColor(this.client.color)
                .setTitle('Raksha - Wiki')
                .setURL('https://runescape.wiki/w/Raksha,_the_Shadow_Colossus')
                .setThumbnail('https://runescape.wiki/images/0/0a/Raksha%2C_the_Shadow_Colossus.png')
                .setDescription(
                    `**Commons GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData.regularGpPerKill).toLocaleString()}\` gp *(no uniques)*\n` +
                    `**Total GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData.overallGpPerKill).toLocaleString()}\` gp *(with uniques)*`
                )
                .addFields([
                    {
                        name: `GP/Hour (${revenueData.killsPerHour} kph)`,
                        value: `<:Coins:1400432187924287579> ${Math.round(revenueData.overallGpPerHour).toLocaleString()} gp`,
                        inline: false
                    }
                ])

            await interaction.editReply({ content: 'Embed sent!'});

            if (interaction.channel && 'send' in interaction.channel) {
                const message = await interaction.channel.send({ embeds: [embed] });
                await this.trackEmbed(message.id, interaction.channelId, interaction.guildId);
            }

        } catch (error) {
            this.client.logger.error({ message: 'Error calculating boss revenue', error });

            const errorEmbed = new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription('Failed to calculate boss revenue. Please try again later.');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    private async getCachedOrFreshData(): Promise<BossRevenueData> {
        const now = Date.now();
        const cache = BossRevenue.cache;

        if (cache && (now - cache.cachedAt) < BossRevenue.CACHE_TTL) {
            return cache;
        }

        const freshData = await this.calculateRakshaRevenue();
        BossRevenue.cache = { ...freshData, cachedAt: now };
        return freshData;
    }

    private loadBossConfig(): BossConfig {
        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return configData.raksha || { kph: 20 };
        } catch (error) {
            return { kph: 20 };
        }
    }

    private async calculateRakshaRevenue(): Promise<BossRevenueData> {
        const dropTable = await this.fetchRakshaDropTable();
        if (dropTable.length === 0) {
            throw new Error('Unable to fetch drop table data');
        }

        const config = this.loadBossConfig();
        const killsPerHour = config.kph;
        const itemPrices = await this.getItemPrices(dropTable.map(item => item.name));
        const regularDrops = dropTable.filter(drop => !drop.isUnique);
        const uniqueDrops = dropTable.filter(drop => drop.isUnique);

        let regularValue = 0;
        for (const drop of regularDrops) {
            const price = itemPrices[drop.name];
            if (price !== undefined && price > 0) {
                const dropValue = (price * drop.quantity) / drop.rarity;
                regularValue += dropValue;
            }
        }

        let overallValue = regularValue;
        for (const drop of uniqueDrops) {
            const price = itemPrices[drop.name];
            if (price !== undefined && price > 0) {
                const dropValue = (price * drop.quantity) / drop.rarity;
                overallValue += dropValue;
            }
        }

        const regularGpPerKill = Math.round(regularValue);
        const overallGpPerKill = Math.round(overallValue);

        return {
            regularGpPerKill,
            overallGpPerKill,
            killsPerHour,
            regularGpPerHour: regularGpPerKill * killsPerHour,
            overallGpPerHour: overallGpPerKill * killsPerHour,
            calculationTime: new Date().toLocaleString()
        };
    }

    private async fetchRakshaDropTable(): Promise<DropTableItem[]> {
        try {
            // Use the main Raksha page which has the actual drop table, not the money making guide
            const rakshaUrl = 'https://runescape.wiki/w/Raksha,_the_Shadow_Colossus';
            const response = await axios.get(rakshaUrl, {
                headers: {
                    'User-Agent': 'Amascut Discord Bot - Boss Revenue Calculator'
                },
                timeout: 15000
            });

            return this.parseRakshaDropTable(response.data);

        } catch (error) {
            return [];
        }
    }

    private async fetchRakshaDropTableV2(): Promise<DropTableItem[]> {
        try {
            // Use the main Raksha page which has the actual drop table, not the money making guide
            const rakshaUrl = 'https://runescape.wiki/w/Raksha,_the_Shadow_Colossus?action=edit';
            const response = await axios.get(rakshaUrl, {
                headers: {
                    'User-Agent': 'Amascut Discord Bot - Boss Revenue Calculator'
                },
                timeout: 15000
            });

            return this.parseRakshaDropTableV2(response.data);

        } catch (error) {
            return [];
        }
    }

    private parseRakshaDropTable(html: string): DropTableItem[] {
        const dropTable: DropTableItem[] = [];

        try {
            const allTablesRegex = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)<\/table>/gis;
            let tableMatch;

            while ((tableMatch = allTablesRegex.exec(html)) !== null) {
                const tableContent = tableMatch[1];

                if (this.isDropTable(tableContent)) {
                    const items = this.parseDropTableRows(tableContent);
                    dropTable.push(...items);
                }
            }

            return dropTable;

        } catch (error) {
            return [];
        }
    }

    private parseRakshaDropTableV2(html: string): DropTableItem[] {
        const dropTable: DropTableItem[] = [];

        try {
            const allTablesRegex = /{{DropsTableHead}}(.*?){{DropsTableBottom}}/gis;
            const match = html.matchAll(allTablesRegex);

            if (match) {
                match.forEach(signleDropTable => {
                    dropTable.push(...this.parseDropTableV2(signleDropTable[0]));
                });
            }

            return dropTable;
        } catch (error) {
            return [];
        }
    }

    private isDropTable(tableContent: string): boolean {
        const dropIndicators = [
            // Generic drop table terms
            'quantity', 'rarity', 'drop rate', 'chance', 'always', 'common', 'uncommon', 'rare', 'very rare',
            // Fraction patterns
            '1/1', '1/', '/1',
            // Percentage patterns
            '%', 'percent',
            // Common drop items (seeds, spirits, salvage, etc.)
            'seed', 'spirit', 'salvage', 'bone', 'hide', 'dust', 'rune', 'stone',
            // Unique items
            'fleeting boots', 'shadow spike', 'ricochet', 'chain', 'divert', 'codex'
        ];

        const lowerContent = tableContent.toLowerCase();
        const matchCount = dropIndicators.filter(indicator => lowerContent.includes(indicator)).length;

        return matchCount >= 2;
    }

    private parseDropTableRows(tableContent: string): DropTableItem[] {
        const items: DropTableItem[] = [];

        const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
        let rowMatch;

        while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
            const rowHtml = rowMatch[1];

            // Skip header rows
            if (rowHtml.includes('<th') || !rowHtml.includes('<td')) {
                continue;
            }

            const cells = this.extractTableCells(rowHtml);

            if (cells.length >= 4) {
                const itemName = this.extractItemNameFromCell(cells[1]);
                const quantity = this.extractQuantityFromCell(cells[2]);
                const rarity = this.extractRarityFromCell(cells[3]);

                if (itemName && quantity > 0 && rarity > 0) {
                    items.push({
                        name: itemName,
                        quantity: quantity,
                        rarity: rarity,
                        isUnique: this.isUniqueItem(itemName)
                    });
                }
            }
        }

        return items;
    }

    private parseDropTableV2(tableContent: string): DropTableItem[] {
        const dropTable: DropTableItem[] = [];

        try {
            const allLinesRegex = /\{\{DropsLine\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/gis;
            const match = tableContent.matchAll(allLinesRegex);

            if (match) {
                match.forEach(line => {
                    //clean up the line
                    const cleanUpRegex = /\{\{DropNote[^{}]*\}\}/g;
                    const value = line[0].replace(cleanUpRegex, '');

                    // line example {{DropsLine|name=Catalytic anima stone|quantity=40-60|rarity=12/100}}
                    const splittedLine: string[] = value.split('|');

                    let item: DropTableItem = {
                        name: '',
                        quantity: 0,
                        rarity: 0,
                        isUnique: false
                    };

                    splittedLine.forEach(entry => {
                        if (entry.startsWith('name=')) {
                            item.name = entry.slice(5);
                            item.isUnique = this.isUniqueItem(item.name);
                        } else if (entry.startsWith('quantity=')) {
                            item.quantity = this.extractQuantityFromCell(entry.slice(9));
                        } else if (entry.startsWith('rarity=')) {
                            item.rarity = this.extractRarityFromCell(entry.slice(7));
                        }
                    });

                    if (item.name && item.quantity > 0) {
                        dropTable.push(item);
                    }
                });
            }

            return dropTable;
        } catch (error) {
            return [];
        }
    }

    private extractTableCells(rowHtml: string): string[] {
        const cells: string[] = [];
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            const cellContent = cellMatch[1]
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&#160;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/\s+/g, ' ')
                .trim();
            cells.push(cellContent);
        }

        return cells;
    }

    private extractItemNameFromCell(cell: string): string {
        let name = cell.replace(/^\d+(?:-\d+)?\s*×?\s*/i, '').trim();
        name = name.replace(/\s*\([^)]*\)\s*$/g, '').trim();

        if (name.includes('|')) {
            name = name.split('|').pop()?.trim() || name;
        }

        return name;
    }

    private extractQuantityFromCell(cell: string): number {
        const quantityMatch = cell.match(/(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?/);

        if (!quantityMatch) return 0;

        const min = parseFloat(quantityMatch[1]);
        const max = quantityMatch[2] ? parseFloat(quantityMatch[2]) : min;

        return (min + max) / 2;
    }

    private extractRarityFromCell(cell: string): number {
        const expressionMatch = cell.match(/\{\{#expr:(.*?)\}\}/);
        if (expressionMatch) {
            return eval(expressionMatch[1]);
        }

        const complexFractionMatch = cell.match(/1\s*\/\s*(\d+(?:\.\d+)?)\s*(?:;|$)/);
        if (complexFractionMatch) {
            return parseFloat(complexFractionMatch[1]);
        }

        const percentMatch = cell.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
            return 100 / parseFloat(percentMatch[1]);
        }

        const fractionMatch = cell.match(/1\s*\/\s*(\d+(?:\.\d+)?)/);
        if (fractionMatch) {
            return parseFloat(fractionMatch[1]);
        }

        const ratioMatch = cell.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        if (ratioMatch) {
            const numerator = parseFloat(ratioMatch[1]);
            const denominator = parseFloat(ratioMatch[2]);
            return denominator / numerator;
        }

        const lowerCell = cell.toLowerCase();
        if (lowerCell.includes('always')) return 1;
        if (lowerCell.includes('common')) return 4;
        if (lowerCell.includes('uncommon')) return 8;
        if (lowerCell.includes('rare')) return 16;
        if (lowerCell.includes('very rare')) return 64;

        return 0;
    }



    private isUniqueItem(itemName: string): boolean {
        const uniqueItems = [
            'Fleeting boots', 'Shadow spike', 'Greater Ricochet ability codex',
            'Greater Chain ability codex', 'Divert ability codex'
        ];
        return uniqueItems.some(unique => itemName.toLowerCase().includes(unique.toLowerCase()));
    }



    private async getItemPrices(itemNames: string[]): Promise<Record<string, number>> {
        const priceMap: Record<string, number> = {};
        const batchSize = 10;

        for (let i = 0; i < itemNames.length; i += batchSize) {
            const batch = itemNames.slice(i, i + batchSize);
            const itemQuery = batch.join('|');

            try {
                const response = await axios.get(
                    `https://api.weirdgloop.org/exchange/history/rs/latest?name=${encodeURIComponent(itemQuery)}`,
                    {
                        headers: {
                            'User-Agent': 'Amascut-Discord-Bot - Boss Revenue Calculator'
                        }
                    }
                );

                if (response.data) {
                    Object.entries(response.data).forEach(([itemName, priceData]: [string, any]) => {
                        if (priceData && typeof priceData.price === 'number') {
                            priceMap[itemName] = priceData.price;
                        }
                    });
                }
            } catch (error) {
                this.client.logger.error({ message: `Failed to fetch prices for batch: ${itemQuery}`, error });
            }
        }

        return priceMap;
    }



    private async trackEmbed(messageId: string, channelId: string, guildId: string | null): Promise<void> {
        if (!guildId) return;

        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            let configData: any = {};

            try {
                const configFile = fs.readFileSync(configPath, 'utf8');
                configData = JSON.parse(configFile);
            } catch (error) {
                configData = {};
            }

            if (!configData.raksha) {
                configData.raksha = { kph: 20, trackedEmbeds: [] };
            }
            if (!configData.raksha.trackedEmbeds) {
                configData.raksha.trackedEmbeds = [];
            }

            configData.raksha.trackedEmbeds = configData.raksha.trackedEmbeds
                .filter((embed: TrackedEmbed) => embed.guildId !== guildId)
                .concat(configData.raksha.trackedEmbeds.filter((embed: TrackedEmbed) => embed.guildId === guildId).slice(-4));

            configData.raksha.trackedEmbeds.push({
                messageId,
                channelId,
                guildId,
                postedAt: Date.now()
            });

            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));
        } catch (error) {
            this.client.logger.error({ message: 'Error tracking embed', error });
        }
    }

    private createEmbedFromData(revenueData: BossRevenueData): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(this.client.color)
            .setTitle('Raksha - Wiki')
            .setURL('https://runescape.wiki/w/Raksha,_the_Shadow_Colossus')
            .setThumbnail('https://runescape.wiki/images/0/0a/Raksha%2C_the_Shadow_Colossus.png')
            .setDescription(
                `**Commons GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData.regularGpPerKill).toLocaleString()}\` gp *(no uniques)*\n` +
                `**Total GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData.overallGpPerKill).toLocaleString()}\` gp *(with uniques)*`
            )
            .addFields([
                {
                    name: `GP/Hour (${revenueData.killsPerHour} kph)`,
                    value: `<:Coins:1400432187924287579> ${Math.round(revenueData.overallGpPerHour).toLocaleString()} gp`,
                    inline: false
                }
            ]);
    }

    public async updateAllTrackedEmbeds(): Promise<void> {
        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

            if (!configData.raksha?.trackedEmbeds) return;

            const revenueData = await this.getCachedOrFreshData();
            const embed = this.createEmbedFromData(revenueData);

            const validEmbeds: TrackedEmbed[] = [];

            for (const trackedEmbed of configData.raksha.trackedEmbeds) {
                try {
                    const guild = this.client.guilds.cache.get(trackedEmbed.guildId);
                    if (!guild) continue;

                    const channel = guild.channels.cache.get(trackedEmbed.channelId);
                    if (!channel?.isTextBased()) continue;

                    const message = await channel.messages.fetch(trackedEmbed.messageId);
                    await message.edit({ embeds: [embed] });

                    validEmbeds.push(trackedEmbed);
                } catch (error) {
                    this.client.logger.error({ message: 'Error updating tracked embed', error });
                }
            }

            configData.raksha.trackedEmbeds = validEmbeds;
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));

        } catch (error) {
            this.client.logger.error({ message: 'Error updating tracked embeds', error });
        }
    }

    public static startAutoUpdater(client: any): void {
        setInterval(async () => {
            try {
                const instance = new BossRevenue(client);
                await instance.updateAllTrackedEmbeds();
            } catch (error) {
                client.logger.error({ message: 'Error in auto-updater', error });
            }
        }, 10 * 60 * 1000);
    }
}
