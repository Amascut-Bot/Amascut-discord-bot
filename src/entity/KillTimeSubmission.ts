import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class KillTimeSubmission {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    submitterId: string;

    @Column()
    teamSize: string;

    @Column()
    killTime: string;

    @Column()
    vodLink: string;

    @Column()
    base: string;

    @Column()
    dps1: string;

    @Column({ nullable: true })
    dps2: string;

    @Column({ nullable: true })
    dps3: string;

    @Column({ nullable: true })
    approvedBy: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ default: 'pending' })
    status: string; // pending, approved, rejected
} 