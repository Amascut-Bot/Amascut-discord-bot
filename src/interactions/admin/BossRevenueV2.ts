import { EmbedBuilder, MessageFlags, SlashCommandBuilder, ContainerBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface GePriceApiResponse {
    itemId: number;
    itemName: string;
    lastBuy: number;
    lastSell: number;
}

const GEPRICE_UNIQUE_ITEMS: Record<string, number> = {
    "Devourer's Guard": 59354,
    "Tumeken's Light": 59350,
    "Mask of Tumeken's resplendence": 59344,
    "Robe top of Tumeken's resplendence": 59336,
    "Robe bottom of Tumeken's resplendence": 59346,
    "Gloves of Tumeken's resplendence": 59342,
    "Boots of Tumeken's resplendence": 59340,
    "The Devourer's Nexus": 59358,
    "Shard of Genesis Essence": 57128
};

interface DropTableItem {
    name: string;
    quantity: number;
    dropRate: number;
    isUnique: boolean;
    price: number;
}

interface BossRevenueData {
    overallGpPerKill: number;
    overallGpPerKillAfterTax: number;
    killsPerHour: number;
    overallGpPerHourAfterTax: number;
}

interface BossConfig {
    kph: number;
    lastMessageId?: string;
    lastChannelId?: string;
    lastGuildId?: string;
    lastUpdated?: number;
}

export default class BossRevenueV2 extends BotInteraction {
    get name() {
        return 'amascut-revenue';
    }

    get description() {
        return 'Calculate GP per kill and GP per hour for Amascut, the Devourer based on current prices';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('calculate')
                    .setDescription('Calculate and post new Amascut revenue data')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('refresh')
                    .setDescription('Force refresh the last posted Amascut revenue message')
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'calculate') {
            return await this.handleCalculate(interaction);
        } else if (subcommand === 'refresh') {
            return await this.handleRefresh(interaction);
        }
    }

    private async handleCalculate(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral});

        try {
            await interaction.editReply({ content: 'Processing Amascut, the Devourer...' });

            const url = 'https://runescape.wiki/w/Money_making_guide/Killing_Amascut,_the_Devourer?action=edit';
            const versions = ['100 Enrage', '500 Enrage', '750 Enrage', '1000 Enrage', '2000 Enrage'];
                    const revenueData: Record<string, BossRevenueData> = {};

            for (const version of versions) {
                        try {
                    revenueData[version] = await this.calculateRevenue(version, url);
                        } catch (error) {
                            continue;
                        }
                    }

            if (Object.keys(revenueData).length > 0 && interaction.channel && 'send' in interaction.channel) {
                const config = this.loadBossConfig();
                const container = new ContainerBuilder()
                    .setAccentColor(this.client.color);

                container.addSectionComponents(section => section
                    .addTextDisplayComponents(builder => builder.setContent(`# Amascut, the Devourer\n\nLast updated: ${new Date().toLocaleString('en-GB')}`))
                    .setThumbnailAccessory(thumbnail => thumbnail
                        .setDescription('Amascut, the Devourer')
                        .setURL('https://runescape.wiki/images/thumb/Amascut%2C_the_Devourer.png/280px-Amascut%2C_the_Devourer.png')
                    )
                );

                for (const version of versions) {
                        if (revenueData[version]) {
                        const data = revenueData[version];
                        
                        container.addSeparatorComponents(separator => separator.setSpacing(1));
                        
                        container.addTextDisplayComponents(builder => builder.setContent([
                            `## ${version.replace(' Enrage', '% Enrage')}`,
                            `**GP/Kill:** <:Coins:1400432187924287579> ${data.overallGpPerKillAfterTax.toLocaleString()}`,
                            `**GP/Hour:** <:Coins:1400432187924287579> ${data.overallGpPerHourAfterTax.toLocaleString()}`
                        ].join('\n')));
                    }
                }
                
                container.addSeparatorComponents(separator => separator.setSpacing(1));
                container.addTextDisplayComponents(builder => builder.setContent(
                    `*-# All GP/Hour values are approximate and based on ${config.kph} kills per hour. Data is taken from the [GEPrice.com](https://discord.gg/qvaaUX2fcK) price checking service for uniques, with [RS Wiki](https://runescape.wiki/w/Amascut,_the_Devourer) pricing for common loot.*`
                ));

                const message = await interaction.channel.send({ 
                    components: [container], 
                    flags: MessageFlags.IsComponentsV2, 
                    allowedMentions: { "parse": [] } 
                });
                
                if (message) {
                await this.trackEmbed(message.id, interaction.channelId, interaction.guildId);
                }
            }

            await interaction.editReply({ content: 'Posted!'});
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.red)
                .setDescription('Failed to calculate boss revenue. Please try again later.');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    private async handleRefresh(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral});

        try {
            await interaction.editReply({ content: 'Force refreshing Amascut revenue message...' });
            
            await this.refreshLastMessage();
            
            await interaction.editReply({ content: 'Successfully refreshed the last Amascut revenue message!' });
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.red)
                .setDescription('Failed to refresh the message. Make sure there is a recent Amascut revenue message to refresh.');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    private loadBossConfig(): BossConfig {
        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return configData.amascut || { kph: 6 };
        } catch (error) {
            return { kph: 6 };
        }
    }

    private async calculateRevenue(version: string, url: string): Promise<BossRevenueData> {
        const dropTable = await this.fetchDropTable(version, url);
        if (dropTable.length === 0) {
            throw new Error('Unable to fetch drop table data');
        }

        const config = this.loadBossConfig();
        const itemPrices = await this.getItemPrices(dropTable.map(item => item.name));
        const uniquePrices = await this.getUniquePricesFromGePriceApi();

        for (const drop of dropTable) {
            if (drop.isUnique) {
                const matchingKey = Object.keys(GEPRICE_UNIQUE_ITEMS).find(
                    key => drop.name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(drop.name.toLowerCase())
                );
                if (matchingKey && uniquePrices[matchingKey] !== undefined) {
                    itemPrices[drop.name] = uniquePrices[matchingKey];
                }
            }
        }

        let overallValue = 0;
        for (const drop of dropTable) {
            const price = itemPrices[drop.name] || drop.price || 0;
            if (price > 0) {
                overallValue += (price * drop.quantity);
            }
        }

        const overallGpPerKill = Math.round(overallValue);
        const overallGpPerKillAfterTax = Math.round(overallGpPerKill * 0.98);
        const overallGpPerHourAfterTax = overallGpPerKillAfterTax * config.kph;

        return {
            overallGpPerKill: overallGpPerKill,
            overallGpPerKillAfterTax: overallGpPerKillAfterTax,
            killsPerHour: config.kph,
            overallGpPerHourAfterTax: overallGpPerHourAfterTax
        };
    }

    private async fetchDropTable(version: string, url: string): Promise<DropTableItem[]> {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Amascut Discord Bot - Boss Revenue Calculator' },
                timeout: 15000
            });
            return await this.parseDropTable(version, response.data);
        } catch (error) {
            return [];
        }
    }

    private async parseDropTable(version: string, html: string): Promise<DropTableItem[]> {
        try {
            const regex = new RegExp(`${version !== '' ? version + '=' : ''}\\s*(\\{\\{Mmgtable[\\s\\S]*?\\}\\}\n(?:\n|\\|\\-\\|))`, 'gis');
            let match = html.match(regex);

            if (!match && html.includes(`${version}=`)) {
                const extracted = this.extractTemplate(version, html);
                if (extracted) match = [extracted];
            }

            if (!match) return [];

            return await this.parseWikiContent(match[0]);
        } catch (error) {
            return [];
        }
    }

    private async parseWikiContent(content: string): Promise<DropTableItem[]> {
        const dropTable: DropTableItem[] = [];

        try {
            const processed = this.resolveVariables(content);
            const segments = this.parseMarkup(processed);
            const outputs = segments.filter(val => val.startsWith('Output'));

            let item: DropTableItem = { name: '', quantity: 0, dropRate: 1, isUnique: false, price: 0 };

            for (let i = 0; i < outputs.length; i++) {
                const entry = outputs[i];
                const nameMatch = entry.match(/Output\d+\s*=\s*(.+)$/);
                const quantityMatch = entry.match(/Output\d+num\s*=\s*(.+)$/);
                const priceMatch = entry.match(/Output\d+value\s*=\s*(.+)$/);

                if (nameMatch) {
                    if (i > 0) dropTable.push(item);
                    const rawName = nameMatch[1];
                    item = {
                        name: this.sanitizeName(rawName),
                        quantity: 0,
                        dropRate: 1,
                        isUnique: this.isUnique(rawName),
                        price: 0
                    };
                }

                if (quantityMatch) {
                    item.quantity = this.parseQuantity(quantityMatch[1]);
                }

                if (priceMatch) {
                    item.price = await this.parsePrice(priceMatch[1]);
                }

                if (i === outputs.length - 1) {
                    dropTable.push(item);
                }
            }

            return dropTable;
        } catch (error) {
            return [];
        }
    }

    private sanitizeName(name: string): string {
        return name
            .replace(/\[\[([^|\]]+)\|?[^\]]*\]\]/g, '$1')
            .replace(/<!--.*?-->/g, '')
            .replace(/\{\{!\}\}/g, '|')
            .replace(/\{\{[^}]+\}\}/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\|.*/, '')
            .trim();
    }

    private parseMarkup(content: string): string[] {
        const rawSegments = content.split('|').map(s => s.trim()).filter(s => s.length > 0);
        const segments: string[] = [];
        let i = 0;

        while (i < rawSegments.length) {
            let segment = rawSegments[i];

            if (this.hasUnbalanced(segment)) {
                let merged = segment;
                let j = i + 1;

                while (j < rawSegments.length && this.hasUnbalanced(merged) && j < i + 50) {
                    merged += '|' + rawSegments[j];
                    j++;
                }

                segments.push(merged);
                i = j;
            } else {
                segments.push(segment);
                i++;
            }
        }

        return segments;
    }

    private hasUnbalanced(text: string): boolean {
        return (text.match(/\{\{/g) || []).length !== (text.match(/\}\}/g) || []).length;
    }

    private extractTemplate(version: string, html: string): string | null {
        const startIndex = html.indexOf(`${version}=`);
        if (startIndex === -1) return null;

        const sectionEnd = this.findSectionEnd(html, startIndex + version.length + 1);
        const fullSection = html.substring(startIndex, sectionEnd);
        const mmgtableIndex = fullSection.indexOf('{{Mmgtable');

        if (mmgtableIndex === -1) return null;

        return this.extractMmgtable(html, startIndex + mmgtableIndex);
    }

    private findSectionEnd(html: string, searchStart: number): number {
        for (let i = searchStart; i < html.length - 1; i++) {
            if (html[i] === '\n') {
                const lineStart = i + 1;
                const lineEnd = html.indexOf('\n', lineStart);
                const line = lineEnd !== -1 ? html.substring(lineStart, lineEnd) : html.substring(lineStart);

                if (/^[^{}\|]+=$/.test(line.trim())) {
                    return lineStart;
                }
            }
        }
        return html.length;
    }

    private extractMmgtable(html: string, start: number): string {
        let braceCount = 0;
        let end = start + 2;

        for (let i = start; i < html.length - 1; i++) {
            if (html.substring(i, i + 2) === '{{') {
                braceCount++;
                i++;
            } else if (html.substring(i, i + 2) === '}}') {
                braceCount--;
                if (braceCount === 0) {
                    end = i + 2;
                    break;
                }
                i++;
            }
        }

        return html.substring(start, end);
    }


    private resolveVariables(content: string): string {
        const variables: Record<string, string> = {};

        const matches = content.match(/\{\{#vardefine:([^|]+)\|([^}]+)\}\}/g) || [];
        for (const match of matches) {
            const inner = match.replace('{{#vardefine:', '').replace('}}', '');
            const pipeIndex = inner.indexOf('|');
            if (pipeIndex !== -1) {
                variables[inner.substring(0, pipeIndex)] = inner.substring(pipeIndex + 1);
            }
        }

        for (let i = 0; i < 3; i++) {
            for (const [key, value] of Object.entries(variables)) {
                variables[key] = this.evaluateExpression(this.resolveRefs(value, variables));
            }
        }

        let processed = content.replace(/\{\{#vardefine:[^}]+\}\}/g, '');

        for (const [key, value] of Object.entries(variables)) {
            processed = processed.replace(
                new RegExp(`\\{\\{#var:${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g'),
                value
            );
        }

            processed = processed.replace(/\{\{#var:[^}]+\}\}/g, '0');

        return processed;
    }

    private resolveRefs(text: string, variables: Record<string, string>): string {
        for (const [key, value] of Object.entries(variables)) {
            if (!value.includes('{{')) {
                text = text.replace(
                    new RegExp(`\\{\\{#var:${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g'),
                    value
                );
            }
        }
        return text;
    }

    private evaluateExpression(text: string): string {
        text = text.replace(/\{\{min\|([^|]+)\|([^}]+)\}\}/g, (match, a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            return !isNaN(numA) && !isNaN(numB) ? Math.min(numA, numB).toString() : match;
        });

        text = text.replace(/\{\{#ifexpr:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^}]+)\s*\}\}/g, (match, condition, trueVal, falseVal) => {
            try {
                return this.evalMath(condition.trim()) ? trueVal.trim() : falseVal.trim();
            } catch {
                return falseVal.trim();
            }
        });

        text = text.replace(/\{\{#expr:\s*([^}]+)\s*\}\}/g, (match, expr) => {
            try {
                return this.evalMath(expr.trim()).toString();
            } catch {
                return '0';
            }
        });

        return text;
    }

    private evalMath(expr: string): number {
        const sanitized = expr.replace(/[^\d+\-*/.() <>]/g, '').replace(/\s+/g, '');
        if (!sanitized || sanitized.includes('{{')) return 0;
        try {
            const result = new Function(`return ${sanitized}`)();
            return typeof result === 'number' && !isNaN(result) ? result : 0;
        } catch {
            return 0;
        }
    }




    private parseQuantity(cell: string): number {
        if (cell.includes('<') || cell.includes('>')) {
            const clean = cell.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
            const match = clean.match(/[\d,]+(?:\.[\d]+)?/);
            return match ? parseFloat(match[0].replace(/,/g, '')) : 1;
        }

        if (cell.includes('%') || cell.includes('–') || cell.includes('-')) {
            const rangeMatch = cell.match(/(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)/);
            if (rangeMatch) {
                return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
            }

            const singleMatch = cell.match(/(\d+(?:\.\d+)?)/);
            return singleMatch ? parseFloat(singleMatch[1]) : 1;
        }

        try {
            return eval(cell.replace('{{#expr:', '').replace('}}', ''));
        } catch {
            return 1;
        }
    }

    private async parsePrice(cell: string): Promise<number> {
        try {
            if (cell.includes('average drop value')) return 0;

            let processed = cell
                .replace(/\{GETotal¦/g, '(')
                .replace(/¦([+\-*/])¦/g, ' $1 ')
                .replace(/¦\}/g, ')')
                .replace(/\{cvexpr¦/g, '(')
                .replace(/\{\{GEP\|([^}]+)\}\}/g, '$1')
                .replace(/¦/g, '+')
                .replace(/\}/g, ')');

            const itemMatches = [...processed.match(/[A-Z][A-Za-z0-9\s,''-]+?(?=\s*[\+\-\*\/\(\)]|$)/g) || []];
            if (itemMatches.length > 0) {
                const prices = await this.getItemPrices(itemMatches);
                for (const item of itemMatches.sort((a, b) => b.length - a.length)) {
                    processed = processed.replace(
                        new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                        (prices[item] || 0).toString()
                    );
                }
            }

            const sanitized = processed.replace(/[^\d+\-*/.() ]/g, '');
            const result = new Function(`return ${sanitized}`)();
            return typeof result === 'number' && !isNaN(result) ? result : 0;
        } catch {
            return 0;
        }
    }

    private isUnique(itemName: string): boolean {
        const uniques = [
            "Tumeken's Light", "Devourer's Guard", "Shard of Genesis Essence", 
            "The Devourer's Nexus", "Mask of Tumeken's resplendence", 
            "Robe top of Tumeken's resplendence", "Robe bottom of Tumeken's resplendence",
            "Gloves of Tumeken's resplendence", "Boots of Tumeken's resplendence"
        ];
        return uniques.some(unique => itemName.toLowerCase().includes(unique.toLowerCase()));
    }

    private async getUniquePricesFromGePriceApi(): Promise<Record<string, number>> {
        const priceMap: Record<string, number> = {};

        await Promise.all(
            Object.entries(GEPRICE_UNIQUE_ITEMS).map(async ([itemName, itemId]) => {
                try {
                    const response = await axios.get<GePriceApiResponse>(
                        `https://api.geprice.com/api/prices/${itemId}?numDays=30`,
                        { headers: { 'User-Agent': 'Amascut-Discord-Bot - Boss Revenue Calculator' }, timeout: 10000 }
                    );
                    const { lastBuy, lastSell } = response.data;
                    if (lastBuy && lastSell) {
                        priceMap[itemName] = Math.round((lastBuy + lastSell) / 2);
                    } else if (lastBuy) {
                        priceMap[itemName] = lastBuy;
                    } else if (lastSell) {
                        priceMap[itemName] = lastSell;
                    }
                } catch {
                }
            })
        );

        return priceMap;
    }

    private async getItemPrices(itemNames: string[]): Promise<Record<string, number>> {
        const priceMap: Record<string, number> = {};
        const batchSize = 10;

        for (let i = 0; i < itemNames.length; i += batchSize) {
            const batch = itemNames.slice(i, i + batchSize);
            try {
                const response = await axios.get(
                    `https://api.weirdgloop.org/exchange/history/rs/latest?name=${encodeURIComponent(batch.join('|'))}`,
                    { headers: { 'User-Agent': 'Amascut-Discord-Bot - Boss Revenue Calculator' } }
                );

                if (response.data) {
                    Object.entries(response.data).forEach(([itemName, priceData]: [string, any]) => {
                        if (priceData?.price) priceMap[itemName] = priceData.price;
                    });
                }
            } catch (error) {
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
                configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch {
                configData = {};
            }

            if (!configData.amascut) configData.amascut = { kph: 6 };
            
            configData.amascut.lastMessageId = messageId;
            configData.amascut.lastChannelId = channelId;
            configData.amascut.lastGuildId = guildId;
            configData.amascut.lastUpdated = Date.now();

            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));
        } catch (error) {
            console.error('Failed to track message:', error);
        }
    }

    public async refreshLastMessage(): Promise<void> {
        try {
            const config = this.loadBossConfig();
            if (!config.lastMessageId || !config.lastChannelId) {
                return;
            }

            const channel = await this.client.channels.fetch(config.lastChannelId);
            if (!channel || !('send' in channel)) return;

            const message = await channel.messages.fetch(config.lastMessageId);
            if (!message) return;

            const url = 'https://runescape.wiki/w/Money_making_guide/Killing_Amascut,_the_Devourer?action=edit';
            const versions = ['100 Enrage', '500 Enrage', '750 Enrage', '1000 Enrage', '2000 Enrage'];
            const revenueData: Record<string, BossRevenueData> = {};

            for (const version of versions) {
                try {
                    revenueData[version] = await this.calculateRevenue(version, url);
                } catch (error) {
                    continue;
                }
            }

            if (Object.keys(revenueData).length > 0) {
                const container = new ContainerBuilder()
                    .setAccentColor(this.client.color);

                container.addSectionComponents(section => section
                    .addTextDisplayComponents(builder => builder.setContent(`# Amascut, the Devourer\n\nLast updated: ${new Date().toLocaleString('en-GB')}`))
                    .setThumbnailAccessory(thumbnail => thumbnail
                        .setDescription('Amascut, the Devourer')
                        .setURL('https://runescape.wiki/images/thumb/Amascut%2C_the_Devourer.png/280px-Amascut%2C_the_Devourer.png')
                    )
                );

                for (const version of versions) {
                    if (revenueData[version]) {
                        const data = revenueData[version];
                        
                        container.addSeparatorComponents(separator => separator.setSpacing(1));
                        
                        container.addTextDisplayComponents(builder => builder.setContent([
                            `## ${version.replace(' Enrage', '% Enrage')}`,
                            `**GP/Kill:** <:Coins:1400432187924287579> ${data.overallGpPerKillAfterTax.toLocaleString()}`,
                            `**GP/Hour:** <:Coins:1400432187924287579> ${data.overallGpPerHourAfterTax.toLocaleString()}`
                        ].join('\n')));
                    }
                }
                
                container.addSeparatorComponents(separator => separator.setSpacing(1));
                container.addTextDisplayComponents(builder => builder.setContent(
                    `*-# All GP/Hour values are approximate and based on ${config.kph} kills per hour. Data is taken from the [GEPrice.com](https://discord.gg/qvaaUX2fcK) price checking service for uniques, with [RS Wiki](https://runescape.wiki/w/Amascut,_the_Devourer) pricing for common loot.*`
                ));

                await message.edit({ 
                    components: [container], 
                    flags: MessageFlags.IsComponentsV2, 
                    allowedMentions: { "parse": [] } 
                });

                console.log(`Amascut revenue message refreshed: ${config.lastMessageId}`);
            }
        } catch (error) {
            console.error('Failed to refresh message:', error);
        }
    }

    public startAutoRefresh(): void {
        setInterval(() => {
            this.refreshLastMessage();
        }, 3600000);
        console.log('Amascut auto-refresh started (hourly)');
    }
}