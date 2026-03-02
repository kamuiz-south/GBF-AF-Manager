import { evaluateArtifact } from './evaluator.ts';
import fs from 'fs';

const dummyArtifact = {
    artifact_id: 301100101, // Not rare
    skill1_info: { skill_id: 10111, skill_quality: 5, name: "攻撃力" }, // G1, baseId 1011
    skill2_info: { skill_id: 10211, skill_quality: 5, name: "HP" },    // G1, baseId 1021
    skill3_info: { skill_id: 20111, skill_quality: 5, name: "通常攻撃ダメージ上限" }, // G2, baseId 2011
    skill4_info: { skill_id: 50021, skill_quality: 1, name: "弱体アビリティ使用時、敵に被ダメージUP(2回)" } // G3, baseId 5002
};

const settings = {
    evaluationFormula: {
        group1Multiplier: 10,
        group2Multiplier: 5,
        group3Multiplier: 1,
        skillMultipliers: {
            "1011": 2.0, // 攻撃力 x2
            "1021": 0.5, // HP x0.5
            "2011": 3.0, // G2 x3
            "5002": 1.5  // G3 x1.5
        },
        qualityValues: {
            1: 10,
            5: 50
        }
    }
};

console.log("Score:", evaluateArtifact(dummyArtifact, settings));
