use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TextSignal {
    pub characters: Vec<String>,
    pub unique_count: usize,
}

pub fn extract_text_signal(input: &str) -> TextSignal {
    let mut characters: Vec<String> = input
        .chars()
        .filter(|character| !character.is_whitespace())
        .map(|character| character.to_string())
        .collect();
    characters.sort();
    characters.dedup();

    TextSignal {
        unique_count: characters.len(),
        characters,
    }
}

#[cfg(test)]
mod tests {
    use super::extract_text_signal;

    #[test]
    fn extracts_unique_characters() {
        let signal = extract_text_signal("我的家");
        assert_eq!(signal.unique_count, 3);
        assert!(signal.characters.contains(&"我".to_string()));
    }
}
