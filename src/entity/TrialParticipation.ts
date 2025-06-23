import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm"
import { Trial } from "./Trial";

@Entity()
export class TrialParticipation {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    participant: string

    @Column()
    role: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;

    @ManyToOne(type => Trial, trial => trial.participants) trial: Trial;
}
