-- Delete questions from removed disciplines
DELETE FROM questoes WHERE disciplina IN ('Língua Portuguesa', 'Raciocínio Lógico', 'Direito Administrativo', 'Constituição Federal');

-- Also delete any user answers referencing those deleted questions
DELETE FROM respostas_usuario WHERE questao_id NOT IN (SELECT id FROM questoes);