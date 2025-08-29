import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface DropTableItem {
    name: string;
    quantity: number;
    dropRate: number;
    isUnique: boolean;
    price: number;
}

interface BossRevenueData {
    regularGpPerKill: number;
    overallGpPerKill: number;
    killsPerHour: number;
    regularGpPerHour: number;
    overallGpPerHour: number;
    calculationTime: string;
}

interface TrackedEmbed {
    messageId: string;
    channelId: string;
    guildId: string;
    postedAt: number;
}

interface BossConfig {
    kph: number;
    trackedEmbeds?: TrackedEmbed[];
}

interface Bosses {
    name: string;
    url: string;
    wikiUrl: string;
    thumbnail: string;
    versions: string[];
}

export default class BossRevenueV2 extends BotInteraction {
    get name() {
        return 'boss-revenuevtwo';
    }

    get description() {
        return 'Calculate GP per kill and GP per hour for bosses based on current prices';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral});

        try {
            const bosses: Bosses[] = [
                {
                    name: 'Telos',
                    url: 'https://runescape.wiki/w/Money_making_guide/Killing_Telos,_the_Warden?action=edit',
                    wikiUrl: 'https://runescape.wiki/w/Telos,_the_Warden',
                    thumbnail: 'https://runescape.wiki/images/thumb/Telos%2C_the_Warden.png/201px-Telos%2C_the_Warden.png?99e18',
                    versions: ['2449 Enrage Claims', '999 Enrage Claims', '100 Enrage Claims']
                },
                {
                    name: 'Arch-Glacor',
                    url: 'https://runescape.wiki/w/Money_making_guide/Killing_the_Arch-Glacor?action=edit',
                    wikiUrl: 'https://runescape.wiki/w/Arch-Glacor',
                    thumbnail: 'https://runescape.wiki/images/thumb/Arch-Glacor.png/280px-Arch-Glacor.png',
                    versions: ['Normal Mode', 'Hard Mode 1000 percent enrage claims']
                },
                {
                    name: 'Sanctum of Rebirth',
                    url: 'https://runescape.wiki/w/Money_making_guide/Sanctum_of_Rebirth?action=edit',
                    wikiUrl: 'https://runescape.wiki/w/Sanctum_of_Rebirth',
                    thumbnail: 'https://runescape.wiki/images/thumb/Nakatra%2C_Devourer_Eternal.png/280px-Nakatra%2C_Devourer_Eternal.png',
                    versions: ['Normal Mode', 'Hard Mode']
                },
                {
                    name: 'Zamorak, Lord of Chaos',
                    url: 'https://runescape.wiki/w/Money_making_guide/Killing_Zamorak,_Lord_of_Chaos?action=edit',
                    wikiUrl: 'https://runescape.wiki/w/Zamorak,_Lord_of_Chaos',
                    thumbnail: 'https://runescape.wiki/images/thumb/Zamorak%2C_Lord_of_Chaos.png/280px-Zamorak%2C_Lord_of_Chaos.png',
                    versions: ['50 enrage', '100 enrage', '300 enrage', '500 enrage', '2000 enrage']
                },
                {
                    name: 'Nex: Angel of Death',
                    url: 'https://runescape.wiki/w/Money_making_guide/Killing_Nex:_Angel_of_Death?action=edit',
                    wikiUrl: 'https://runescape.wiki/w/Nex:_Angel_of_Death',
                    thumbnail: 'https://runescape.wiki/images/thumb/Nex%2C_Angel_of_Death.png/280px-Nex%2C_Angel_of_Death.png',
                    versions: ['7-player', '4-player', 'Duo', 'Solo']
                }
            ];

            for (let i = 0; i < bosses.length; i++) {
                const boss = bosses[i];

                try {
                    await interaction.editReply({ content: `Processing ${boss.name}... (${i + 1}/${bosses.length})` });

                    const revenueData: Record<string, BossRevenueData> = {};
                    let description = '';

                    for (const version of boss.versions) {
                        try {
                            console.log(`Calculating revenue for ${boss.name} - ${version}`);
                            revenueData[version] = await this.calculateRevenue(version, boss.url);
                            console.log(`${boss.name} - ${version}: ${revenueData[version].regularGpPerKill}/${revenueData[version].overallGpPerKill} gp/kill`);
                        } catch (error) {
                            console.log(`Error calculating revenue for ${boss.name} - ${version}:`, error);
                            continue;
                        }
                    }

            const fields: any[] = [];

                    boss.versions.forEach(version => {
                        if (revenueData[version]) {
                description += `## ${version}:\n`;
                            description += `**Commons GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData[version].regularGpPerKill).toLocaleString()}\` gp *(no uniques)*\n`;
                            description += `**Total GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData[version].overallGpPerKill).toLocaleString()}\` gp *(with uniques)*\n`;

                            fields.push({
                                name: `## ${version}:\nGP/Hour (${revenueData[version].killsPerHour} kph)`,
                                value: `<:Coins:1400432187924287579> ${Math.round(revenueData[version].overallGpPerHour).toLocaleString()} gp`,
                        inline: false
                            });
                    }
            });

                    if (description && fields.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(this.client.color)
                            .setTitle(`${boss.name} - Wiki`)
                            .setURL(boss.wikiUrl)
                            .setThumbnail(boss.thumbnail)
                            .setDescription(description.trim())
                .addFields(fields);

            if (interaction.channel && 'send' in interaction.channel) {
                const message = await interaction.channel.send({ embeds: [embed] });
                await this.trackEmbed(message.id, interaction.channelId, interaction.guildId);
                        }
                    }
                } catch (error) {
                    continue;
                }
            }

            await interaction.editReply({ content: 'Embed sent!'});
        } catch (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(this.client.util.colours.discord.red)
                .setDescription('Failed to calculate boss revenue. Please try again later.');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
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

    private async calculateRevenue(version: string, url: string): Promise<BossRevenueData> {
        if (url.includes('Nex:_Angel_of_Death')) {
            return await this.calculateAodRevenue(version);
        }

        const dropTable = await this.fetchDropTable(version, url);
        if (dropTable.length === 0) {
            throw new Error('Unable to fetch drop table data');
        }

        const config = this.loadBossConfig();
        const itemPrices = await this.getItemPrices(dropTable.map(item => item.name));

        const regularDrops = dropTable.filter(drop => !drop.isUnique);
        const uniqueDrops = dropTable.filter(drop => drop.isUnique);

        let regularValue = 0;
        for (const drop of regularDrops) {
            const price = itemPrices[drop.name] || drop.price || 0;
            if (price > 0) {
                regularValue += (price * drop.quantity);
            }
        }

        let overallValue = regularValue;
        for (const drop of uniqueDrops) {
            const price = itemPrices[drop.name] || drop.price || 0;
            if (price > 0) {
                overallValue += (price * drop.quantity);
            }
        }

        return {
            regularGpPerKill: Math.round(regularValue),
            overallGpPerKill: Math.round(overallValue),
            killsPerHour: config.kph,
            regularGpPerHour: Math.round(regularValue) * config.kph,
            overallGpPerHour: Math.round(overallValue) * config.kph,
            calculationTime: new Date().toLocaleString()
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
            let processed = content;

            if (content.includes('<!--chest-->')) {
                processed = this.preprocessAod(content);
            }

            processed = this.resolveVariables(processed);

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

    private preprocessAod(content: string): string {
        return content
            .replace(/\{\{var\|([^|]+)\|([^}]+)\}\}/g, (match, key, value) =>
                key.startsWith('Output') ? `|${key} = ${value}` : match
            )
            .replace(/\|Output\d+\s*=\s*\{\{#var:Output\d+\}\}/g, '')
            .replace(/\{\{#var:Output\d+\}\}/g, '');
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

        if (content.includes('<!--chest-->')) {
            processed = processed.replace(/\{\{#var:(?!Output\d+)[^}]+\}\}/g, '0');
            processed = this.cleanupTemplates(processed);
        } else {
            processed = processed.replace(/\{\{#var:[^}]+\}\}/g, '0');
        }

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

    private cleanupTemplates(text: string): string {
        return text
            .replace(/\{\{#expr:[^}]*\}\}/g, '0')
            .replace(/\{\{#ifexpr:[^}]*\}\}/g, '0')
            .replace(/\{\{[^}]*\}\}/g, '');
    }

    private async calculateAodRevenue(version: string): Promise<BossRevenueData> {
        const response = await axios.get('https://runescape.wiki/w/Nex:_Angel_of_Death', {
            headers: { 'User-Agent': 'Amascut Discord Bot' },
            timeout: 15000
        });

        const dropTable = await this.parseAodHtml(response.data);
        if (dropTable.length === 0) {
            throw new Error(`No drop table data found for AOD ${version}`);
        }

        const config = this.loadBossConfig();
        const itemPrices = await this.getItemPrices(dropTable.map(item => item.name));

        const regularDrops = dropTable.filter(drop => !drop.isUnique);
        const uniqueDrops = dropTable.filter(drop => drop.isUnique);
        const teamSize = this.getTeamSize(version);

        console.log(`AOD ${version} - Total items parsed: ${dropTable.length}`);
        console.log(`AOD ${version} - Common items:`, regularDrops.map(d => `${d.name} (${d.quantity})`));
        console.log(`AOD ${version} - Unique items:`, uniqueDrops.map(d => `${d.name} (${d.quantity})`));

        let regularValue = 0;
        for (const drop of regularDrops) {
            const price = itemPrices[drop.name] || 0;
            if (price > 0) {
                regularValue += price * drop.quantity;
                console.log(`AOD ${version} - Adding common: ${drop.name} = ${price} * ${drop.quantity} = ${price * drop.quantity}`);
            }
        }

        let overallValue = regularValue;
        for (const drop of uniqueDrops) {
            const price = itemPrices[drop.name] || 0;
            if (price > 0) {
                overallValue += price * this.getDropChance(drop.name, teamSize);
            }
        }

        return {
            regularGpPerKill: Math.round(regularValue),
            overallGpPerKill: Math.round(overallValue),
            killsPerHour: config.kph,
            regularGpPerHour: Math.round(regularValue) * config.kph,
            overallGpPerHour: Math.round(overallValue) * config.kph,
            calculationTime: new Date().toLocaleString()
        };
    }

    private async parseAodHtml(html: string): Promise<DropTableItem[]> {
        const dropTable: DropTableItem[] = [];
        const tableRegex = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
        let tableMatch;

        while ((tableMatch = tableRegex.exec(html)) !== null) {
            if (this.isDropTable(tableMatch[1])) {
                dropTable.push(...this.parseTableRows(tableMatch[1]));
            }
        }

        return dropTable;
    }

    private isDropTable(content: string): boolean {
        const indicators = ['item', 'quantity', 'rarity', 'praesul', 'wand', 'core', 'codex', 'chest'];
        return indicators.some(indicator => content.toLowerCase().includes(indicator));
    }

    private parseTableRows(content: string): DropTableItem[] {
        const items: DropTableItem[] = [];
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;

        while ((rowMatch = rowRegex.exec(content)) !== null) {
            if (rowMatch[1].includes('<th')) continue;

            const cells = this.extractCells(rowMatch[1]);
            if (cells.length >= 2) {
                const itemName = this.extractItemName(cells[0]);
                const quantity = this.parseAodQuantity(cells[1]);
                const dropRate = this.getAodItemDropRate(itemName);

                console.log(`AOD item: ${itemName}, quantity: ${quantity}, dropRate: ${dropRate}, cells: ${cells.length}`);

                if (itemName && quantity > 0) {
                    items.push({
                        name: itemName,
                        quantity: quantity * dropRate,
                        dropRate: 1,
                        isUnique: this.isUnique(itemName),
                        price: 0
                    });
                }
            }
        }

        return items;
    }

    private extractItemName(cell: string): string {
        let name = cell;

        const aodPattern = /^([^.]+)\.png:\s*RS3\s+Nex,\s*Angel\s+of\s+Death\s+drops\s+([^]+?)\s+with\s+rarity/i;
        const aodMatch = name.match(aodPattern);
        if (aodMatch) return aodMatch[2].trim();

        if (/^\d+[–-]\d+%$|^\d+%$/.test(name.trim())) return '';

        name = name
            .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1')
            .replace(/<img[^>]*>/gi, '')
            .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\.png$|\.gif$|\.jpg$/gi, '')
            .replace(/:\s*RS3.*$/i, '')
            .trim();

        return name && name !== '?' && name !== '-' ? name : '';
    }

    private getTeamSize(version: string): number {
        const v = version.toLowerCase();
        if (v.includes('7-player')) return 7;
        if (v.includes('4-player')) return 4;
        if (v.includes('duo')) return 2;
        if (v.includes('solo')) return 1;
        return 7;
    }

    private getDropChance(itemName: string, teamSize: number): number {
        const item = itemName.toLowerCase();

        const weapChance = teamSize > 7 ? 1/10000 : 1/(284 * teamSize);

        if (item.includes('praesul codex')) {
            return (1 / (36 * Math.min(teamSize, 7))) * (1 - 2 * weapChance);
        }
        if (item.includes('wand of the praesul') || item.includes('imperium core')) {
            return weapChance;
        }
        if (item.includes('intricate') && item.includes('chest')) return 1 / 5000;

        return 1 / 1000;
    }

    private parseAodQuantity(cell: string): number {
        const clean = cell.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

        const rangeMatch = clean.match(/(\d+(?:,\d+)?(?:\.\d+)?)[–-](\d+(?:,\d+)?(?:\.\d+)?)/);
        if (rangeMatch) {
            const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
            const max = parseFloat(rangeMatch[2].replace(/,/g, ''));
            return (min + max) / 2;
        }

        const numberMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
        return numberMatch ? parseFloat(numberMatch[1].replace(/,/g, '')) : 1;
    }

    private getAodItemDropRate(itemName: string): number {
        const name = itemName.toLowerCase();

        // Very rare drops (0.1% chance)
        if (name.includes('uncut onyx')) return 0.001;
        if (name.includes('blood tentacle')) return 0.001;
        if (name.includes('starved ancient effigy')) return 0.001;

        // Rare drops (1% chance)
        if (name.includes('crystal key')) return 0.01;
        if (name.includes('crystal triskelion')) return 0.01;
        if (name.includes('sirenic scale')) return 0.01;

        // Uncommon drops (10% chance)
        if (name.includes('uncut dragonstone')) return 0.1;
        if (name.includes('ascendri bolts')) return 0.1;
        if (name.includes('onyx bolt tips')) return 0.1;

        // All other items are common (100% chance)
        return 1.0;
    }

    private extractCells(rowHtml: string): string[] {
        const cells: string[] = [];
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            cells.push(cellMatch[1]);
        }

        return cells;
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
            // Telos uniques
            'Dormant staff of Sliske', 'Dormant Seren godbow', 'Dormant Zaros godsword',
            'Reprisal Ability Codex',
            // AOD uniques
            'Praesul codex', 'Wand of the praesul', 'Imperium core', 'Intricate blood stained chest',
            'Intricate ice chest', 'Intricate smoke-shrouded chest', 'Intricate shadow chest',
            // AOD shit drops/not commons
            'The Promised Gift', 'The Praesul', 'Blood tentacle', 'Starved ancient effigy',
            'Crystal triskelion',
            // Arch-Glacor uniques
            'Leng artefact', 'Scripture of Wen', 'Frozen core of Leng', 'Dark Shard of Leng',
            'Dark Sliver of Leng', 'Dark ice shard', 'Dark ice sliver',
            // Sanctum uniques
            'Scripture of Amascut', 'Divine Rage prayer codex', 'Road of Awakening',
            'Ode to Deceit', 'Shard of Genesis',
            // Zamorak uniques
            'Bow of the Last Guardian',
            'Chaos Roar Ability Codex',
            'Vestments of havoc hood', 'Vestments of havoc robe top', 'Vestments of havoc robe bottom',
            'Vestments of havoc boots', 'Vestments of havoc gloves',

        ];
        return uniques.some(unique => itemName.toLowerCase().includes(unique.toLowerCase()));
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
                // Silent fail for price fetching
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

            if (!configData.raksha) configData.raksha = { kph: 20, trackedEmbeds: [] };
            if (!configData.raksha.trackedEmbeds) configData.raksha.trackedEmbeds = [];

            configData.raksha.trackedEmbeds = configData.raksha.trackedEmbeds
                .filter((embed: TrackedEmbed) => embed.guildId !== guildId)
                .concat(configData.raksha.trackedEmbeds.filter((embed: TrackedEmbed) => embed.guildId === guildId).slice(-4));

            configData.raksha.trackedEmbeds.push({ messageId, channelId, guildId, postedAt: Date.now() });
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));
        } catch (error) {
            // Silent fail for embed tracking
        }
    }
}
