import { useLocalSearchParams } from 'expo-router';
import { AddHubScreen } from '@/features/add/add-hub-screen';
import { VocabularyFormScreen } from '@/features/bank/vocabulary-form-screen';

export default function AddRoute() {
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  return cardId ? <VocabularyFormScreen /> : <AddHubScreen />;
}
