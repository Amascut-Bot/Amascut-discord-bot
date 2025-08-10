import { google, sheets_v4 } from 'googleapis';
import Bot from '../Bot';

export interface SheetConfig {
    sheetId: string;
    range?: string;
}

export interface EventParticipant {
    timestamp: string;
    rsn: string;
    discordName: string;
    availability: string;
    enrageLevel: string;
    voiceChat: string;
    streamConsent: string;
    additionalNotes: string;
    discordStatus: string;
    team: string;
}

export default class GoogleSheetsHandler {
    private client: Bot;
    private sheets: sheets_v4.Sheets;
    private auth: any;

    constructor(client: Bot) {
        this.client = client;
        this.initializeAuth();
    }

    private initializeAuth() {
        try {
            // Try to load from JSON file first, then environment variables
            let credentials: any;
            
            try {
                // Try loading from credentials file
                const fs = require('fs');
                const path = require('path');
                const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
                
                if (fs.existsSync(credentialsPath)) {
                    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
                    this.client.logger.log({ 
                        message: 'Loaded Google credentials from file', 
                        handler: this.constructor.name 
                    }, true);
                }
            } catch (fileError) {
                // File doesn't exist or is invalid, continue to env vars
            }

            // If no file, use environment variables
            if (!credentials) {
                const privateKey = process.env.GOOGLE_PRIVATE_KEY;
                if (!privateKey) {
                    throw new Error('GOOGLE_PRIVATE_KEY environment variable is required or create google-credentials.json file');
                }

                // Clean and format the private key - handle multiple formats
                let formattedPrivateKey = privateKey;
                
                // Remove quotes if present
                if (formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) {
                    formattedPrivateKey = formattedPrivateKey.slice(1, -1);
                }
                
                // Replace escaped newlines with actual newlines
                formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
                
                // Ensure it starts and ends with proper markers
                if (!formattedPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
                    throw new Error('Private key must start with -----BEGIN PRIVATE KEY-----');
                }

                credentials = {
                    type: "service_account",
                    project_id: process.env.GOOGLE_PROJECT_ID || "pvml-459417",
                    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "9c23790d2d454d0bff51b82e83ee9469f1a6bdb7",
                    private_key: formattedPrivateKey,
                    client_email: process.env.GOOGLE_CLIENT_EMAIL || "pvmleeches@pvml-459417.iam.gserviceaccount.com",
                    client_id: process.env.GOOGLE_CLIENT_ID || "102498857329262208287",
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL || "pvmleeches@pvml-459417.iam.gserviceaccount.com")}`,
                    universe_domain: "googleapis.com"
                };

                this.client.logger.log({ 
                    message: 'Loaded Google credentials from environment variables', 
                    handler: this.constructor.name 
                }, true);
            }

            this.auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            this.client.logger.log({ 
                message: 'Google Sheets authentication initialized successfully', 
                handler: this.constructor.name 
            }, true);
        } catch (error) {
            this.client.logger.error({ 
                message: 'Failed to initialize Google Sheets authentication', 
                error, 
                handler: this.constructor.name 
            });
        }
    }

    /**
     * Read data from a Google Sheet
     * @param sheetId - The ID of the Google Sheet
     * @param range - The range to read (e.g., 'A1:J100', 'Sheet1!A:J')
     * @returns Promise<string[][]> - 2D array of cell values
     */
    public async readSheet(sheetId: string, range: string = 'A:J'): Promise<string[][]> {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: range,
            });

            const rows = response.data.values || [];
            this.client.logger.log({ 
                message: `Successfully read ${rows.length} rows from sheet ${sheetId}`, 
                handler: this.constructor.name 
            }, true);
            
            return rows;
        } catch (error) {
            this.client.logger.error({ 
                message: `Failed to read sheet ${sheetId}`, 
                error, 
                handler: this.constructor.name 
            });
            throw error;
        }
    }

    /**
     * Parse event participants from sheet data
     * @param rows - Raw sheet data (2D array)
     * @returns EventParticipant[] - Parsed participant objects
     */
    public parseEventParticipants(rows: string[][]): EventParticipant[] {
        if (rows.length < 3) {
            this.client.logger.log({ 
                message: 'Sheet has insufficient data rows', 
                handler: this.constructor.name 
            }, true);
            return [];
        }

        // Skip header rows (row 1 has headers, row 2 has color coding info)
        const dataRows = rows.slice(2);
        const participants: EventParticipant[] = [];

        for (const row of dataRows) {
            // Skip empty rows
            if (!row || row.length < 2 || !row[1]?.trim()) continue;

            const participant: EventParticipant = {
                timestamp: row[0] || '',
                rsn: row[1] || '',
                discordName: row[2] || '',
                availability: row[3] || '',
                enrageLevel: row[4] || '',
                voiceChat: row[5] || '',
                streamConsent: row[6] || '',
                additionalNotes: row[7] || '',
                discordStatus: row[8] || '',
                team: row[9] || ''
            };

            participants.push(participant);
        }

        this.client.logger.log({ 
            message: `Parsed ${participants.length} event participants`, 
            handler: this.constructor.name 
        }, true);

        return participants;
    }

    /**
     * Get event participants from the Amascut event sheet
     * @param sheetId - The sheet ID (defaults to the known Amascut sheet)
     * @returns Promise<EventParticipant[]> - Array of parsed participants
     */
    public async getEventParticipants(sheetId: string = '1I4VgXusgdouIyX2b52pukUfrTSca10xHW8EPTmb5x_s'): Promise<EventParticipant[]> {
        try {
            const rows = await this.readSheet(sheetId, 'A:J');
            return this.parseEventParticipants(rows);
        } catch (error) {
            this.client.logger.error({ 
                message: 'Failed to get event participants', 
                error, 
                handler: this.constructor.name 
            });
            return [];
        }
    }

    /**
     * Filter participants by team assignment
     * @param participants - Array of participants
     * @param teamName - Team name to filter by (e.g., 'a-team', 'b-team')
     * @returns EventParticipant[] - Filtered participants
     */
    public filterByTeam(participants: EventParticipant[], teamName: string): EventParticipant[] {
        return participants.filter(p => 
            p.team.toLowerCase().includes(teamName.toLowerCase())
        );
    }

    /**
     * Get participants who haven't been assigned to a team yet
     * @param participants - Array of participants
     * @returns EventParticipant[] - Unassigned participants
     */
    public getUnassignedParticipants(participants: EventParticipant[]): EventParticipant[] {
        return participants.filter(p => 
            !p.team || p.team.trim() === '' || p.team.toLowerCase() === 'message sent'
        );
    }

    /**
     * Write data to a Google Sheet
     * @param sheetId - The ID of the Google Sheet  
     * @param range - The range to write to
     * @param values - 2D array of values to write
     * @returns Promise<void>
     */
    public async writeSheet(sheetId: string, range: string, values: string[][]): Promise<void> {
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: range,
                valueInputOption: 'RAW',
                requestBody: {
                    values: values,
                },
            });

            this.client.logger.log({ 
                message: `Successfully wrote ${values.length} rows to sheet ${sheetId}`, 
                handler: this.constructor.name 
            }, true);
        } catch (error) {
            this.client.logger.error({ 
                message: `Failed to write to sheet ${sheetId}`, 
                error, 
                handler: this.constructor.name 
            });
            throw error;
        }
    }
}
