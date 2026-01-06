const fs = require('fs');
let content = fs.readFileSync('app/(customer)/request-service.tsx', 'utf8');

const newEffect = `
  useEffect(() => {
    if (!userId) return;
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('home_lat, home_lng, city, state')
        .eq('id', userId)
        .single();
      if (error) {
        console.warn('Failed to load profile:', error.message);
        return;
      }
      if (data?.home_lat && data?.home_lng) {
        setSavedLat(data.home_lat);
        setSavedLng(data.home_lng);
        const addr = [data.city, data.state].filter(Boolean).join(', ');
        if (addr) {
          setSavedAddress(addr);
          setLocation(addr);
        }
      }
    };
    loadProfile();
  }, [userId]);
`;

content = content.replace(
  '}, []);\n\n  const fetchQuestionsFromDB',
  '}, []);' + newEffect + '\n  const fetchQuestionsFromDB'
);

fs.writeFileSync('app/(customer)/request-service.tsx', content);
console.log('Done');
