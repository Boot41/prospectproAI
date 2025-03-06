import os
import json
from groq import Groq
from dotenv import load_dotenv
import httpx

load_dotenv()

class GroqService:
    def __init__(self):
        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            raise ValueError('GROQ_API_KEY not found in environment variables')
            
        self.client = Groq(
            api_key=api_key,
            http_client=httpx.Client()
        )
        self.model = "mixtral-8x7b-32768"

    def extract_relevant_fields(self, message):
        """Extract relevant fields from the user message"""
        # Field mappings with their keywords and corresponding column names
        field_mappings = {
            'company_name': ['company', 'startup', 'business', 'organization', 'companies'],
            'location': ['location', 'based in', 'from', 'in', 'where'],
            'funding_amount': ['funding', 'raised', 'investment', 'money'],
            'investors': ['investors', 'backed by', 'invested by', 'VC', 'VCs', 'venture capital'],
            'industry': ['industry', 'sector', 'field', 'domain'],
            'established_year': ['year', 'established', 'founded', 'started'],
            'funding_stage': ['stage', 'series', 'round']
        }
        
        message = message.lower()
        relevant_fields = set()
        
        # Always include company_name as it's needed for context
        relevant_fields.add('company_name')
        
        # Check each field mapping against the message
        for field_name, keywords in field_mappings.items():
            if any(keyword in message for keyword in keywords):
                relevant_fields.add(field_name)
        
        return relevant_fields

    def get_response(self, user_message):
        """Get a structured response from Groq API"""
        try:
            # Extract custom column request if present
            def extract_custom_column(message):
                import re
                pattern = r'include\s+([^\s].*?)\s+as\s+([^\s].*?)(?=\.|$)'
                match = re.search(pattern, message)
                if match:
                    return {
                        'content': match.group(1).strip(),
                        'name': match.group(2).strip()
                    }
                return None

            # Extract base location query
            def extract_location_query(message):
                import re
                pattern = r'(?:in|at|from)\s+([^.]+)(?=\.|$)'
                match = re.search(pattern, message)
                if match:
                    return match.group(1).strip()
                return None

            custom_column = extract_custom_column(user_message)
            location = extract_location_query(user_message)
            
            # Extract relevant fields from the user message
            relevant_fields = self.extract_relevant_fields(user_message)
            
            # Always include essential fields
            essential_fields = {'company_name', 'location', 'investors'}
            relevant_fields.update(essential_fields)
            
            # Add custom column if specified
            custom_column_str = ''
            if custom_column:
                custom_column_str = f',\n                            "{custom_column["name"]}": "{custom_column["content"]}"'
                relevant_fields.add(custom_column["name"])
            
            # Extract the actual field name from the filter
            clean_fields = [field.replace('while preserving existing data', '').strip() for field in relevant_fields]
            
            base_prompt = f"""
            You are a highly knowledgeable AI assistant specializing in venture capital and startups.
            {f'Find startups in {location}' if location else 'List notable startups'}
            
            ### INSTRUCTIONS:
            1. Keep ALL existing data from the previous response
            2. For these companies, research and provide accurate data for: {', '.join(clean_fields)}
            3. For each field, provide SPECIFIC numerical or factual data:
               - For team size: Provide the actual number of employees
               - For funding: Provide the amount raised
               - For investors: List key investors
               - For revenue: Provide annual revenue figures
            4. Do not remove or modify existing fields
            5. Do not add any metadata or descriptive fields
            6. IMPORTANT: Return ONLY valid JSON with actual researched data
            
            ### RESPONSE FORMAT (STRICT JSON):
            {{
                "summary": "Brief overview of the startups",
                "data": {{
                    "table_name": "Startup Information",
                    "companies": [
                        {{
                            "company_name": "Company Name",
                            "industry": "Industry/Sector",
                            "funding_stage": "Series A/B/C",
                            "funding_amount": "$X million",
                            "established_year": "YYYY",
                            "investors": "Key investors"{custom_column_str}
                        }}
                    ]
                }}
            }}

            ### STRICT RULES:
            1. Return real startup data, not mock data
            2. Keep all existing columns and data
            3. Format values consistently:
               - Money: "$XM" or "$XB"
               - Years: YYYY
               - Numbers: Use commas for thousands
            4. If adding a custom column, preserve all existing data and add the new column
            5. For the custom column "{custom_column['name'] if custom_column else 'N/A'}", provide {custom_column['content'] if custom_column else 'N/A'}
            
            Remember: Preserve all existing data when adding new information.
            """

            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": base_prompt
                    },
                    {
                        "role": "user",
                        "content": user_message
                    }
                ],
                model=self.model,
                temperature=0.5,  # Lower temperature for more consistent output
                max_tokens=4096,  # Increased max tokens
            )

            response_text = chat_completion.choices[0].message.content.strip()
            
            # Clean up the response text
            response_text = response_text.replace('\_', '_')  # Fix escaped underscores
            response_text = response_text.replace('\\n', ' ')  # Replace escaped newlines with space
            response_text = response_text.replace('\n', ' ')   # Replace actual newlines with space
            response_text = response_text.replace('\"', '"')  # Fix escaped quotes
            response_text = response_text.replace('\\', '')    # Remove remaining backslashes
            response_text = response_text.replace('```json', '').replace('```', '')  # Remove markdown
            
            # Clean up the response text
            response_text = response_text.replace('\\_', '_')  # Fix escaped underscores
            response_text = response_text.replace('\\n', '\n')  # Fix escaped newlines
            response_text = response_text.replace('\n', ' ')    # Replace actual newlines with spaces
            
            # Remove any potential JSON artifacts
            response_text = response_text.strip('`')
            if response_text.startswith('json'):
                response_text = response_text[4:].strip()
            
            # Extract relevant fields from the user message
            relevant_fields = self.extract_relevant_fields(user_message)
            
            # Clean and parse JSON response
            try:
                # Remove any text before the first '{' and after the last '}'
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    response_text = response_text[start_idx:end_idx + 1].strip()
                    # Clean up any escaped characters and normalize whitespace
                    response_text = ' '.join(response_text.split())
                
                data = json.loads(response_text)
                
                # Format arrays into proper structures
                if 'data' in data:
                    formatted_data = {}
                    for key, value in data['data'].items():
                        if isinstance(value, list) and key == 'companies':
                            # Special handling for company data
                            formatted_list = []
                            for item in value:
                                if isinstance(item, str):
                                    try:
                                        # Try to parse if it's a JSON string
                                        company_data = json.loads(item)
                                    except json.JSONDecodeError:
                                        company_data = {'company_name': item}
                                elif isinstance(item, dict):
                                    company_data = item
                                else:
                                    company_data = {'value': str(item)}
                                
                                # Clean and format each field
                                cleaned_data = {}
                                for field_key, field_value in company_data.items():
                                    # Convert key to a clean format
                                    clean_key = field_key.lower().replace(' ', '_')
                                    
                                    # Format the value
                                    def format_value(val):
                                        if isinstance(val, (list, dict)):
                                            return ', '.join(str(v) for v in (val if isinstance(val, list) else val.values()))
                                        elif val is None:
                                            return ''
                                        else:
                                            return str(val)

                                    # Clean up field key by removing metadata text
                                    display_key = field_key
                                    if 'while preserving existing data' in field_key.lower():
                                        display_key = field_key.lower().replace('while preserving existing data', '').strip()
                                    
                                    # Skip pure metadata fields
                                    if display_key.lower() in ['table_name', '']:
                                        continue

                                    # Keep existing data and add new fields
                                    if field_key in company_data:
                                        # Keep existing data as is
                                        cleaned_data[display_key] = format_value(field_value)
                                    elif clean_key in relevant_fields:
                                        # For new fields from the filter, use the AI-generated data
                                        if field_value and not isinstance(field_value, str):
                                            cleaned_data[display_key] = format_value(field_value)
                                        elif isinstance(field_value, str) and not field_value.lower().startswith('total strength'):
                                            cleaned_data[display_key] = field_value
                                
                                formatted_list.append(cleaned_data)
                            formatted_data[key] = formatted_list
                        else:
                            # For other data types, keep as is
                            formatted_data[key] = value
                    data['data'] = formatted_data
                
                # Ensure other required fields exist
                if 'summary' not in data:
                    data['summary'] = ''
                if 'key_insights' not in data:
                    data['key_insights'] = []
                
                return {
                    'status': 'success',
                    'data': data
                }
            except json.JSONDecodeError as e:
                # Try to extract partial JSON if possible
                try:
                    # Find the last complete JSON structure
                    last_brace = response_text.rindex('}')
                    clean_json = response_text[:last_brace + 1]
                    data = json.loads(clean_json)
                    return {
                        'status': 'success',
                        'data': data
                    }
                except (json.JSONDecodeError, ValueError):
                    return {
                        'status': 'error',
                        'message': f'Failed to parse JSON response: {str(e)}',
                        'raw_response': response_text
                    }

        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }