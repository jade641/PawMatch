import { Check, Eye, Send, Sparkles } from "lucide-react-native";
import { Text, View } from "react-native";
import { capitalize, FONT, FONT_BOLD, formatAge, ON_PHOTO_TEXT, shadow, T } from "../constants/theme";
import { WEIGHTS } from "../services/compatibility";
import type { RankedMatch } from "../types";
import { MATCH_PHOTO_HEIGHT, OwnerLine, TemperamentTags, TrustIndicators } from "./DogWidgets";
import { Btn, DogImage, ScoreBar, Tag, VeriBadge } from "./ui";

function CriterionBar({ label, weight, score }: { label: string; weight: string; score: number }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, color: T.dark, fontFamily: FONT }}>
          {label} <Text style={{ color: T.medium }}>({weight})</Text>
        </Text>
        <Text style={{ fontSize: 12, color: T.dark, fontFamily: FONT_BOLD }}>{score}</Text>
      </View>
      <ScoreBar score={score} />
    </View>
  );
}

const pct = (weight: number) => `${Math.round(weight * 100)}%`;

/** Per-criterion breakdown of the weighted sum (paper Tables 8–11). */
export function CompatibilityBreakdownCard({ match }: { match: RankedMatch }) {
  const c = match.compatibility;
  return (
    <View style={{ gap: 10 }}>
      <CriterionBar label={`Breed · ${c.breed.level}`} weight={pct(WEIGHTS.breed)} score={c.breed.score} />
      <CriterionBar label={`Age · ${c.age.difference} yr gap`} weight={pct(WEIGHTS.age)} score={c.age.score} />
      <CriterionBar label={`Sex · ${c.sex.opposite ? "opposite" : "same"}`} weight={pct(WEIGHTS.sex)} score={c.sex.score} />
      <CriterionBar label={`Temperament · ${c.temperament.level}`} weight={pct(WEIGHTS.temperament)} score={c.temperament.score} />
    </View>
  );
}

function FloatingMatchCard({
  match,
  rank,
  selected,
  onSelect,
  onView,
}: {
  match: RankedMatch;
  rank: number;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
}) {
  const { dog, compatibility, reasons } = match;
  return (
    <View
      style={{
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: T.white,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? T.primary : T.border,
        ...shadow,
        elevation: 5,
      }}
    >
      <View>
        <DogImage uri={dog.img} width="100%" height={MATCH_PHOTO_HEIGHT} radius={0} />
        <View
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.95)",
          }}
        >
          <Sparkles size={14} color={T.primary} strokeWidth={2} />
          <Text style={{ fontSize: 12, color: ON_PHOTO_TEXT, fontFamily: FONT_BOLD }}>
            #{rank} • {compatibility.total}% match
          </Text>
        </View>
        <View style={{ position: "absolute", right: 12, top: 12 }}>
          <VeriBadge tier={dog.tier} />
        </View>
      </View>

      <View style={{ padding: 16, gap: 10 }}>
        <View>
          <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD }}>{dog.name}</Text>
          <Text style={{ fontSize: 13, color: T.medium, marginTop: 2, fontFamily: FONT }}>
            {dog.breed} • {formatAge(dog.age)} • {capitalize(dog.sex)} • {capitalize(dog.size)}
          </Text>
        </View>
        <TemperamentTags traits={dog.temperament} />
        <OwnerLine dog={dog} />
        <ScoreBar score={compatibility.total} showLabel />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {reasons.map((r) => (
            <Tag key={r} label={r} tone="brand" />
          ))}
        </View>
        <TrustIndicators dog={dog} />

        {selected && (
          <View style={{ backgroundColor: T.bg, borderRadius: 14, padding: 12 }}>
            <CompatibilityBreakdownCard match={match} />
          </View>
        )}

        {/* Choosing a dog reveals its breakdown; the request is sent from the summary below the list. */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn
            title={selected ? "Selected" : "Choose"}
            icon={selected ? Check : undefined}
            variant={selected ? "secondary" : "primary"}
            size="small"
            onPress={onSelect}
            accessibilityLabel={selected ? `${dog.name} selected` : `Choose ${dog.name}`}
            style={{ flex: 1 }}
          />
          <Btn
            title="View"
            icon={Eye}
            variant="outline"
            size="small"
            onPress={onView}
            accessibilityLabel={`View ${dog.name}'s profile`}
          />
        </View>
      </View>
    </View>
  );
}

export function FloatingMatchResults({
  matches,
  forDogName,
  selectedDogId,
  onSelectDog,
  onViewDog,
  onRequestDog,
}: {
  matches: RankedMatch[];
  forDogName: string;
  selectedDogId: string | null;
  onSelectDog: (dogId: string) => void;
  onViewDog: (match: RankedMatch) => void;
  onRequestDog: (match: RankedMatch) => void;
}) {
  const selected = matches.find((m) => m.dog.id === selectedDogId) ?? null;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ borderRadius: 20, padding: 16, backgroundColor: T.white, borderWidth: 1, borderColor: T.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color={T.primary} strokeWidth={2} />
          <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>
            Top {matches.length} match{matches.length === 1 ? "" : "es"} for {forDogName}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: T.medium, marginTop: 6, lineHeight: 18, fontFamily: FONT }}>
          Ranked by the compatibility score: breed {pct(WEIGHTS.breed)}, age {pct(WEIGHTS.age)}, sex {pct(WEIGHTS.sex)},
          temperament {pct(WEIGHTS.temperament)}. Choose a dog to see its breakdown, then send your request below.
        </Text>
      </View>

      {matches.map((m, i) => (
        <FloatingMatchCard
          key={m.dog.id}
          match={m}
          rank={i + 1}
          selected={m.dog.id === selectedDogId}
          onSelect={() => onSelectDog(m.dog.id)}
          onView={() => onViewDog(m)}
        />
      ))}

      {selected && (
        <View style={{ borderRadius: 20, padding: 16, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Selected dog</Text>
              <Text style={{ fontSize: 18, color: T.dark, fontFamily: FONT_BOLD }}>{selected.dog.name}</Text>
            </View>
            <Text style={{ fontSize: 13, color: T.primaryDark, fontFamily: FONT_BOLD }}>
              {selected.compatibility.total}% match
            </Text>
          </View>
          <Btn title={`Send request to ${selected.dog.name}`} icon={Send} onPress={() => onRequestDog(selected)} />
        </View>
      )}
    </View>
  );
}
